package com.dmc00.fonetica.ipc;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * El protocolo entre Electron y el motor: una línea JSON por mensaje, por stdin y stdout (ADR-0001 del repo).
 * <pre>
 *   al iniciar:  {"ready": true, "version": "0.0.1", ...}
 *   pedido:      {"id": 7, "channel": "lexicon:search-spelling", "args": ["watre", 25]}
 *   respuesta:   {"id": 7, "result": [...]}  ·  {"id": 7, "bytes": "UklGR..."}  ·  {"id": 7, "error": "..."}
 * </pre>
 * Cada pedido se atiende en su propio hilo virtual, así una consulta lenta (Longman, la voz) no frena a las
 * demás. Cuando Electron cierra stdin, el servidor termina los pedidos en curso y vuelve.
 */
public class JsonLineServer {

    private static final System.Logger LOG = System.getLogger(JsonLineServer.class.getName());

    private final Handlers handlers;
    private final ObjectMapper json;

    public JsonLineServer(Handlers handlers, ObjectMapper json) {
        this.handlers = handlers;
        this.json = json;
    }

    /** Atiende pedidos hasta que se cierra la entrada. */
    public void serve(InputStream in, OutputStream out, Map<String, Object> readyInfo) throws IOException {
        Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        Map<String, Object> ready = new LinkedHashMap<>();
        ready.put("ready", true);
        ready.putAll(readyInfo);
        write(writer, ready);

        try (ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();
             BufferedReader lines = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = lines.readLine()) != null) {
                if (line.isBlank()) continue;
                String request = line;
                workers.submit(() -> write(writer, answer(request)));
            }
            workers.shutdown();
            if (!workers.awaitTermination(10, TimeUnit.SECONDS)) {
                LOG.log(System.Logger.Level.WARNING, "Quedaron pedidos sin terminar al cerrar el motor");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** La respuesta a una línea del protocolo; nunca lanza excepción (el error viaja en la respuesta). */
    Map<String, Object> answer(String line) {
        Map<String, Object> response = new LinkedHashMap<>();
        JsonNode request;
        try {
            request = json.readTree(line);
        } catch (RuntimeException e) {
            response.put("id", null);
            response.put("error", "Pedido inválido: no es JSON");
            return response;
        }
        JsonNode id = request.get("id");
        response.put("id", id == null ? null : id);
        try {
            JsonNode channel = request.get("channel");
            if (channel == null || !channel.isString()) throw new IllegalArgumentException("Falta el canal");
            Handlers.Result result = handlers.handle(channel.asString(), request.get("args"));
            switch (result) {
                case Handlers.Json value -> response.put("result", value.value());
                case Handlers.Bytes bytes -> response.put("bytes", Base64.getEncoder().encodeToString(bytes.value()));
            }
        } catch (Exception e) {
            if (!(e instanceof IllegalArgumentException || e instanceof IllegalStateException)) {
                LOG.log(System.Logger.Level.WARNING, "Error en el pedido " + id, e);
            }
            response.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
        }
        return response;
    }

    private static String escape(String text) {
        StringBuilder out = new StringBuilder();
        for (char c : text.toCharArray()) {
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
            else out.append(c);
        }
        return out.toString();
    }

    private void write(Writer writer, Map<String, Object> message) {
        String text;
        try {
            text = json.writeValueAsString(message);
        } catch (RuntimeException | Error e) {
            // Electron espera una respuesta por pedido: si no se puede escribir el resultado, va el error.
            LOG.log(System.Logger.Level.ERROR, "No se pudo convertir la respuesta a JSON", e);
            // Se arma a mano: si falló Jackson, puede volver a fallar.
            Object id = message.get("id");
            text = "{\"id\":" + (id == null ? "null" : id) + ",\"error\":\"" + escape("Error interno del motor: " + e) + "\"}";
        }
        synchronized (writer) {
            try {
                writer.write(text);
                writer.write('\n');
                writer.flush();
            } catch (IOException e) {
                LOG.log(System.Logger.Level.WARNING, "No se pudo escribir la respuesta", e);
            }
        }
    }
}
