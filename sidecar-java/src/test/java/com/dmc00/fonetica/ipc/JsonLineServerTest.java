package com.dmc00.fonetica.ipc;

import static org.assertj.core.api.Assertions.assertThat;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.ldoce.AudioCache;
import com.dmc00.fonetica.ldoce.Fetcher;
import com.dmc00.fonetica.ldoce.LdoceCache;
import com.dmc00.fonetica.ldoce.LdoceClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;

/** El protocolo con Electron: forma de los mensajes, validación de la entrada y errores. */
class JsonLineServerTest {

    @TempDir
    Path tempDir;

    private final List<String> longmanCalls = new ArrayList<>();
    private JsonLineServer server;

    @BeforeEach
    void setUp() {
        Fetcher offline = (url, headers) -> {
            longmanCalls.add(url);
            return new Fetcher.Response(503, url, null, new byte[0]);
        };
        Clock clock = Clock.systemUTC();
        LdoceClient ldoce = new LdoceClient(offline, new LdoceCache(tempDir.resolve("c.json"), TestFiles.JSON, clock),
                new AudioCache(tempDir.resolve("audio")), 0, clock);
        server = new JsonLineServer(new Handlers(TestFiles.britfone(), ldoce, null, null), TestFiles.JSON);
    }

    /** Manda los pedidos (uno por línea), cierra la entrada y devuelve las respuestas en orden de id. */
    private List<JsonNode> exchange(String... requests) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        String input = String.join("\n", requests) + "\n";
        server.serve(new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8)), out, Map.of("words", 3));
        List<JsonNode> messages = new ArrayList<>();
        for (String line : out.toString(StandardCharsets.UTF_8).split("\n")) messages.add(TestFiles.JSON.readTree(line));
        return messages;
    }

    private JsonNode call(String request) throws Exception {
        return exchange(request).get(1);
    }

    @Test
    @DisplayName("lo primero que escribe es el aviso de listo; después responde cada pedido con su id")
    void listoYRespuestas() throws Exception {
        List<JsonNode> messages = exchange(
                "{\"id\":1,\"channel\":\"lexicon:info\",\"args\":[]}",
                "{\"id\":2,\"channel\":\"lexicon:search-spelling\",\"args\":[\"watre\",3]}");
        assertThat(messages.getFirst().get("ready").asBoolean()).isTrue();
        assertThat(messages.getFirst().get("words").asInt()).isEqualTo(3);
        JsonNode second = messages.stream().filter(m -> m.path("id").asInt() == 2).findFirst().orElseThrow();
        assertThat(second.get("result")).hasSize(3);
        assertThat(second.get("result").get(0).get("word").asString()).isEqualTo("water");
        JsonNode first = messages.stream().filter(m -> m.path("id").asInt() == 1).findFirst().orElseThrow();
        assertThat(first.get("result").get("total").asInt()).isEqualTo(15212);
    }

    @Test
    @DisplayName("valida la entrada como Electron: texto obligatorio, límites y fonemas conocidos")
    void validacion() throws Exception {
        assertThat(call("{\"id\":1,\"channel\":\"lexicon:search-spelling\",\"args\":[42]}").get("error").asString())
                .isEqualTo("Se esperaba un texto");
        // Límite fuera de rango → el valor por defecto (25).
        assertThat(call("{\"id\":1,\"channel\":\"lexicon:search-spelling\",\"args\":[\"wa\",1000]}").get("result"))
                .hasSize(25);
        // Los símbolos que no son fonemas se descartan.
        JsonNode phonemes = call("{\"id\":1,\"channel\":\"lexicon:search-phonemes\",\"args\":[[\"k\",\"<script>\",\"æ\",\"t\"],{\"limit\":2}]}");
        assertThat(phonemes.get("result")).hasSize(2);
        assertThat(phonemes.get("result").get(0).get("word").asString()).isEqualTo("cat");
    }

    @Test
    @DisplayName("los campos \"texto o null\" del contrato se escriben como null y los opcionales se omiten")
    void formaDelJson() throws Exception {
        JsonNode sentence = call("{\"id\":1,\"channel\":\"sentence:analyze\",\"args\":[\"Xyzzy cat.\",{}]}").get("result");
        JsonNode unknown = sentence.get("words").get(0);
        assertThat(unknown.has("pron")).isTrue();
        assertThat(unknown.get("pron").isNull()).isTrue();
        assertThat(unknown.get("source").isNull()).isTrue();
        assertThat(unknown.has("note")).isFalse();
        assertThat(unknown.has("functionWord")).isFalse();

        JsonNode prons = call("{\"id\":1,\"channel\":\"lexicon:prons-of\",\"args\":[[\"cat\",\"xyzzy\"]]}").get("result");
        assertThat(prons.get("cat").get("source").asString()).isEqualTo("britfone");
        assertThat(prons.has("xyzzy")).isTrue();
        assertThat(prons.get("xyzzy").isNull()).isTrue();

        JsonNode inflections = call("{\"id\":1,\"channel\":\"lexicon:inflections\",\"args\":[\"xyzzy\"]}").get("result");
        assertThat(inflections.get("basePron").isNull()).isTrue();
        assertThat(inflections.get("s").isNull()).isTrue();
    }

    @Test
    @DisplayName("sin voz ni analizador lo informa como error, igual que antes")
    void sinVozNiAnalizador() throws Exception {
        assertThat(call("{\"id\":1,\"channel\":\"tts:available\",\"args\":[]}").get("result").asBoolean()).isFalse();
        assertThat(call("{\"id\":1,\"channel\":\"tts:phonemes\",\"args\":[\"kæt\",{}]}").get("error").asString())
                .isEqualTo("La voz británica no está instalada (npm run fetch-voice).");
        assertThat(call("{\"id\":1,\"channel\":\"grammar:available\",\"args\":[]}").get("result").asBoolean()).isFalse();
        assertThat(call("{\"id\":1,\"channel\":\"grammar:analyze\",\"args\":[\"Hi.\"]}").get("error").asString())
                .isEqualTo("El analizador gramatical no está instalado (npm run build:nlp).");
    }

    @Test
    @DisplayName("Longman sin conexión: la consulta vuelve como offline y el audio de otro sitio se rechaza")
    void longman() throws Exception {
        JsonNode lookup = call("{\"id\":1,\"channel\":\"ldoce:lookup\",\"args\":[\"water\"]}").get("result");
        assertThat(lookup.get("status").asString()).isEqualTo("offline");
        assertThat(lookup.get("message").asString()).isEqualTo("Longman respondió con el código 503.");
        assertThat(longmanCalls).containsExactly("https://www.ldoceonline.com/search/english/direct/?q=water");
        assertThat(call("{\"id\":1,\"channel\":\"ldoce:audio\",\"args\":[\"https://example.com/media/x.mp3\"]}")
                .get("error").asString()).isEqualTo("URL de audio no permitida");
    }

    @Test
    @DisplayName("un pedido roto o de un canal desconocido no corta el servicio")
    void pedidosRotos() throws Exception {
        List<JsonNode> messages = exchange(
                "esto no es json",
                "{\"id\":2,\"channel\":\"shell:open-in-browser\",\"args\":[\"https://evil\"]}",
                "{\"id\":3,\"channel\":\"lexicon:info\"}");
        assertThat(messages).hasSize(4);
        assertThat(messages).anySatisfy(m -> assertThat(m.path("error").asString()).isEqualTo("Pedido inválido: no es JSON"));
        assertThat(messages).anySatisfy(m -> assertThat(m.path("error").asString()).startsWith("Canal desconocido"));
        assertThat(messages).anySatisfy(m -> assertThat(m.path("result").path("total").asInt()).isEqualTo(15212));
    }
}
