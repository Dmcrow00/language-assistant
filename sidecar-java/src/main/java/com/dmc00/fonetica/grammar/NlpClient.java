package com.dmc00.fonetica.grammar;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Cliente del analizador spaCy ({@code nlp/nlp_server.py}), que corre como proceso aparte.
 *
 * <ul>
 *   <li>En el instalador se usa la versión empaquetada con PyInstaller ({@code resources/nlp/nlp-server}).</li>
 *   <li>En desarrollo, si no se empaquetó todavía, se usa el Python del entorno {@code nlp/.venv}.</li>
 * </ul>
 * El proceso se lanza la primera vez que se pide un análisis (tarda ~1,5 s en cargar el modelo) y queda
 * vivo; si se cae, el próximo pedido lo vuelve a lanzar. Protocolo: una línea JSON por pedido
 * ({@code {"id": 1, "text": "..."}}) y una por respuesta ({@code {"id": 1, "tokens": [...]}} o
 * {@code {"id": 1, "error": "..."}}); al arrancar escribe {@code {"ready": true}}.
 */
public class NlpClient implements AutoCloseable {

    private static final System.Logger LOG = System.getLogger(NlpClient.class.getName());
    private static final long REQUEST_TIMEOUT_MS = 30_000;
    private static final TypeReference<List<ParsedToken>> TOKENS = new TypeReference<>() {
    };

    private final List<String> command;
    private final ObjectMapper json;
    private final Map<Long, CompletableFuture<List<ParsedToken>>> pending = new ConcurrentHashMap<>();
    private final AtomicLong nextId = new AtomicLong(1);
    private Process process;
    private Writer stdin;
    private CompletableFuture<Void> ready;

    public NlpClient(List<String> command, ObjectMapper json) {
        this.command = List.copyOf(command);
        this.json = json;
    }

    /** Busca el analizador: primero el empaquetado, después el entorno de desarrollo; null si no está. */
    public static NlpClient locate(Path resourcesDir, Path projectDir, ObjectMapper json) {
        Path packaged = resourcesDir.resolve("nlp").resolve("nlp-server").resolve("nlp-server.exe");
        if (Files.exists(packaged)) return new NlpClient(List.of(packaged.toString()), json);
        if (projectDir == null) return null;
        Path python = projectDir.resolve("nlp").resolve(".venv").resolve("Scripts").resolve("python.exe");
        Path script = projectDir.resolve("nlp").resolve("nlp_server.py");
        if (Files.exists(python) && Files.exists(script)) {
            return new NlpClient(List.of(python.toString(), script.toString()), json);
        }
        return null;
    }

    public List<ParsedToken> parse(String text) throws IOException, InterruptedException {
        long id = nextId.getAndIncrement();
        CompletableFuture<List<ParsedToken>> answer = new CompletableFuture<>();
        try {
            start().get();
            pending.put(id, answer);
            send(json.writeValueAsString(Map.of("id", id, "text", text)));
            return answer.get(REQUEST_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            throw new IOException("El analizador tardó demasiado en responder.", e);
        } catch (ExecutionException e) {
            throw new IOException(e.getCause().getMessage(), e.getCause());
        } finally {
            pending.remove(id);
        }
    }

    private synchronized void send(String line) throws IOException {
        if (stdin == null) throw new IOException("El analizador se cerró.");
        stdin.write(line + "\n");
        stdin.flush();
    }

    private synchronized CompletableFuture<Void> start() {
        if (ready != null) return ready;
        CompletableFuture<Void> starting = new CompletableFuture<>();
        ready = starting;
        try {
            ProcessBuilder builder = new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD);
            builder.environment().put("PYTHONIOENCODING", "utf-8");
            builder.environment().put("PYTHONUTF8", "1");
            Process child = builder.start();
            process = child;
            stdin = new OutputStreamWriter(child.getOutputStream(), StandardCharsets.UTF_8);
            Thread reader = new Thread(() -> readAnswers(child, starting), "nlp-client");
            reader.setDaemon(true);
            reader.start();
        } catch (IOException e) {
            fail(null, starting, "No se pudo iniciar el analizador: " + e.getMessage());
        }
        return starting;
    }

    private void readAnswers(Process child, CompletableFuture<Void> starting) {
        try (BufferedReader lines = new BufferedReader(new InputStreamReader(child.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = lines.readLine()) != null) {
                JsonNode message;
                try {
                    message = json.readTree(line);
                } catch (RuntimeException e) {
                    continue; // líneas que no son del protocolo (avisos de librerías)
                }
                if (message.path("ready").asBoolean(false)) {
                    starting.complete(null);
                    continue;
                }
                if (!message.has("id") || message.get("id").isNull()) continue;
                CompletableFuture<List<ParsedToken>> waiter = pending.remove(message.get("id").asLong());
                if (waiter == null) continue;
                if (message.hasNonNull("error")) {
                    waiter.completeExceptionally(new IOException(message.get("error").asString()));
                } else {
                    waiter.complete(message.has("tokens") ? json.treeToValue(message.get("tokens"), TOKENS) : List.of());
                }
            }
        } catch (IOException e) {
            LOG.log(System.Logger.Level.DEBUG, "Se cortó la salida del analizador", e);
        }
        int code;
        try {
            code = child.waitFor();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            code = -1;
        }
        fail(child, starting, "El analizador se cerró (código " + code + ").");
    }

    /** El proceso no arrancó o se cayó: fallan los pedidos en curso y el próximo lo vuelve a lanzar. */
    private synchronized void fail(Process child, CompletableFuture<Void> starting, String reason) {
        IOException error = new IOException(reason);
        starting.completeExceptionally(error);
        for (CompletableFuture<List<ParsedToken>> waiter : new ArrayList<>(pending.values())) {
            waiter.completeExceptionally(error);
        }
        pending.clear();
        if (child == null || child == process) {
            process = null;
            stdin = null;
            ready = null;
        }
    }

    @Override
    public synchronized void close() {
        if (process != null) process.destroy();
        process = null;
        stdin = null;
        ready = null;
    }
}
