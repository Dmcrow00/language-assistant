package com.dmc00.fonetica;

import com.dmc00.fonetica.core.Lexicon;
import com.dmc00.fonetica.grammar.NlpClient;
import com.dmc00.fonetica.ipc.Handlers;
import com.dmc00.fonetica.ipc.JsonLineServer;
import com.dmc00.fonetica.ldoce.AudioCache;
import com.dmc00.fonetica.ldoce.JdkFetcher;
import com.dmc00.fonetica.ldoce.LdoceCache;
import com.dmc00.fonetica.ldoce.LdoceClient;
import com.dmc00.fonetica.tts.PiperVoice;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;

/**
 * Arranque del motor: arma el diccionario local, conecta Longman, la voz y el analizador gramatical, y
 * atiende los pedidos de Electron por stdin/stdout hasta que Electron cierra la entrada.
 *
 * <pre>
 *   java -jar fonetica-sidecar.jar --resources &lt;dir&gt; --user-data &lt;dir&gt; [--project &lt;dir&gt;] [--user-agent &lt;texto&gt;]
 * </pre>
 * <ul>
 *   <li>{@code --resources}: carpeta con {@code britfone/}, {@code piper/} y {@code nlp/} (la de recursos del
 *       instalador, o {@code resources/} del proyecto en desarrollo).</li>
 *   <li>{@code --user-data}: carpeta de datos del usuario ({@code %APPDATA%\dmc00-language-assistant}).</li>
 *   <li>{@code --project}: sólo en desarrollo, para usar el Python de {@code nlp/.venv}.</li>
 *   <li>{@code --user-agent}: el de Electron, para que Longman vea el mismo navegador que antes.</li>
 * </ul>
 * stdout es sólo del protocolo; los avisos van a stderr (Electron los muestra en su consola).
 */
public final class SidecarMain {

    private SidecarMain() {
    }

    public static void main(String[] args) throws IOException {
        // stdout queda reservado al protocolo: cualquier System.out.println accidental va a stderr.
        PrintStream protocol = new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8);
        System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.err), true, StandardCharsets.UTF_8));
        // Como Chromium: el proxy configurado en Windows se respeta al consultar Longman.
        System.setProperty("java.net.useSystemProxies", "true");
        useBundledOnnxLibraries();

        Map<String, String> options = parseArgs(args);
        Path resources = Path.of(required(options, "--resources"));
        Path userData = Path.of(required(options, "--user-data"));
        Path project = options.containsKey("--project") ? Path.of(options.get("--project")) : null;
        ObjectMapper json = Json.mapper();
        Clock clock = Clock.systemUTC();

        Lexicon lexicon = new Lexicon();
        lexicon.loadBritfone(Files.readString(resources.resolve("britfone").resolve("britfone.main.3.0.1.csv"),
                StandardCharsets.UTF_8));

        LdoceCache cache = new LdoceCache(userData.resolve("ldoce-cache.json"), json, clock);
        for (LdoceCache.StoredLookup lookup : cache.all()) {
            Handlers.applyLookupToLexicon(lexicon, lookup.status(), lookup.entries());
        }
        LdoceClient ldoce = new LdoceClient(new JdkFetcher(options.get("--user-agent")), cache,
                new AudioCache(userData.resolve("audio")), 1000, clock);

        Path voiceModel = resources.resolve("piper").resolve("en_GB-cori-high.onnx");
        PiperVoice voice = PiperVoice.isInstalled(voiceModel) ? new PiperVoice(voiceModel, json) : null;
        // Analizador gramatical (spaCy): empaquetado en resources/nlp o, en desarrollo, el Python de nlp/.venv.
        NlpClient nlp = NlpClient.locate(resources, project, json);

        Map<String, Object> readyInfo = new LinkedHashMap<>();
        readyInfo.put("version", SidecarMain.class.getPackage().getImplementationVersion());
        readyInfo.put("words", lexicon.size());
        readyInfo.put("voice", voice != null);
        readyInfo.put("grammar", nlp != null);

        Runnable shutdown = () -> {
            cache.close();
            if (nlp != null) nlp.close();
        };
        // Si a la JVM la cierran de golpe (Electron se cae), igual se guarda la caché y se cierra spaCy.
        Thread hook = new Thread(shutdown, "cierre");
        Runtime.getRuntime().addShutdownHook(hook);

        new JsonLineServer(new Handlers(lexicon, ldoce, voice, nlp), json).serve(System.in, protocol, readyInfo);

        Runtime.getRuntime().removeShutdownHook(hook);
        shutdown.run();
        System.exit(0);
    }

    /**
     * El jar no trae las librerías nativas de ONNX Runtime (pesan decenas de MB por plataforma): están en
     * {@code native/}, al lado del jar. Si alguien ya indicó otra carpeta, se respeta.
     */
    private static void useBundledOnnxLibraries() {
        if (System.getProperty("onnxruntime.native.path") != null) return;
        try {
            Path jar = Path.of(SidecarMain.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            Path nativeDir = jar.resolveSibling("native");
            if (Files.isDirectory(nativeDir)) System.setProperty("onnxruntime.native.path", nativeDir.toString());
        } catch (URISyntaxException | RuntimeException e) {
            // Sin carpeta native/ (tests, IDE): ONNX Runtime las saca del propio jar de Maven.
        }
    }

    private static Map<String, String> parseArgs(String[] args) {
        Map<String, String> options = new HashMap<>();
        for (int i = 0; i + 1 < args.length; i += 2) options.put(args[i], args[i + 1]);
        return options;
    }

    private static String required(Map<String, String> options, String name) {
        String value = options.get(name);
        if (value == null) throw new IllegalArgumentException("Falta el argumento " + name);
        return value;
    }
}
