package com.dmc00.fonetica.ldoce;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.api.LdoceEntry;
import com.dmc00.fonetica.api.LdoceLookup;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Portado de {@code electron/test/ldoce.test.ts}: parser y cliente de Longman (sin red: fetch falso). */
class LdoceTest {

    // HTML mínimo armado a mano con la misma estructura que usan las páginas de Longman.
    static final String ENTRY_PAGE = """
            <div class="dictionary">
              <span class="ldoceEntry Entry">
                <span class="frequent Head"><span class="HWD">water</span><span class="HYPHENATION">wa‧ter</span><span class="HOMNUM">1</span>
                  <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">ˈwɔːtə</span><span class="AMEVARPRON"><span class="neutral span"> $ </span>ˈwɒːtər, ˈwɑː-</span><span class="neutral span">/</span></span>
                  <span class="POS"> noun</span>
                  <span data-src-mp3="https://www.ldoceonline.com/media/english/breProns/water_br.mp3?version=1" class="speaker brefile"> </span>
                  <span data-src-mp3="https://www.ldoceonline.com/media/english/ameProns/water_am.mp3?version=1" class="speaker amefile"> </span>
                </span>
                <span class="Sense"><span class="DEF">the clear liquid that falls as rain</span>
                  <span data-src-mp3="https://www.ldoceonline.com/media/english/exaProns/x.mp3" class="speaker exafile"> </span></span>
              </span>
              <span class="ldoceEntry Entry">
                <span class="frequent Head"><span class="HWD">water</span><span class="HOMNUM">2</span><span class="POS"> verb</span></span>
                <span class="Sense"><span class="DEF">to pour <a class="defRef">water<span class="HOMNUM">1</span></a> on plants</span></span>
              </span>
              <span class="bussdictEntry Entry"><span class="Head"><span class="HWD">water</span><span class="PRON">otra</span></span></span>
            </div>""";

    static final String OPTIONAL_PAGE = """
            <span class="ldoceEntry Entry"><span class="Head"><span class="HWD">government</span>
              <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">ˈɡʌv<span class="i">ə</span>mənt, ˈɡʌv<span class="i">ə</span>nmənt</span><span class="neutral span">/</span></span>
              <span class="POS"> noun</span></span></span>""";

    static final String SPELLCHECK_PAGE = """
            <ul class="didyoumean"><li><a href="/search/direct/?q=watered"> watered </a></li>
              <li><a href="/search/direct/?q=-ware">-ware</a></li><li><a href="/search/direct/?q=water">water</a></li></ul>""";

    @Nested
    @DisplayName("parser de Longman")
    class Parser {

        @Test
        @DisplayName("lee palabra, pronunciaciones, audios y definición; ignora el diccionario de negocios")
        void leeLaEntrada() {
            List<LdoceEntry> entries = LdoceParser.parseEntryPage(ENTRY_PAGE);
            assertThat(entries).hasSize(2);
            assertThat(entries.getFirst()).isEqualTo(new LdoceEntry(
                    "water", "1", "noun", "ˈwɔːtə", null, "ˈwɒːtər, ˈwɑː-",
                    "https://www.ldoceonline.com/media/english/breProns/water_br.mp3?version=1",
                    "https://www.ldoceonline.com/media/english/ameProns/water_am.mp3?version=1",
                    "the clear liquid that falls as rain"));
        }

        @Test
        @DisplayName("la segunda entrada hereda la pronunciación de la primera")
        void heredaPronunciacion() {
            LdoceEntry verb = LdoceParser.parseEntryPage(ENTRY_PAGE).get(1);
            assertThat(verb.pos()).isEqualTo("verb");
            assertThat(verb.definition()).isEqualTo("to pour water on plants");
            assertThat(verb.pronBrE()).isEqualTo("ˈwɔːtə");
            assertThat(verb.audioBrE()).contains("water_br.mp3");
        }

        @Test
        @DisplayName("marca los sonidos opcionales entre paréntesis")
        void sonidosOpcionales() {
            assertThat(LdoceParser.parseEntryPage(OPTIONAL_PAGE).getFirst().pronBrE())
                    .isEqualTo("ˈɡʌv(ə)mənt, ˈɡʌv(ə)nmənt");
        }

        @Test
        @DisplayName("lee las sugerencias de \"Did you mean\" sin prefijos ni sufijos sueltos")
        void sugerencias() {
            assertThat(LdoceParser.parseSpellcheckPage(SPELLCHECK_PAGE)).containsExactly("watered", "water");
        }
    }

    /** Un Longman de mentira: devuelve páginas fijas según la palabra buscada y anota cada pedido. */
    static final class FakeFetcher implements Fetcher {
        final Map<String, String[]> pages;
        final List<String> calls = new ArrayList<>();

        FakeFetcher(Map<String, String[]> pages) {
            this.pages = pages;
        }

        @Override
        public Response fetch(String url, Map<String, String> headers) {
            calls.add(url);
            String query = url.contains("?q=") ? url.substring(url.indexOf("?q=") + 3) : "";
            String[] page = pages.get(query);
            return page == null
                    ? new Response(500, url, "text/html", new byte[0])
                    : new Response(200, page[0], "text/html; charset=utf-8", page[1].getBytes(StandardCharsets.UTF_8));
        }
    }

    @Nested
    @DisplayName("cliente de Longman")
    class Cliente {

        @TempDir
        Path tempDir;

        private final Clock clock = Clock.fixed(Instant.parse("2026-10-16T12:00:00Z"), ZoneOffset.UTC);

        private LdoceClient client(FakeFetcher fetcher, String cacheName) {
            return new LdoceClient(fetcher, new LdoceCache(tempDir.resolve(cacheName), TestFiles.JSON, clock),
                    new AudioCache(tempDir.resolve("a")), 0, clock);
        }

        @Test
        @DisplayName("distingue página de palabra y página de sugerencias, y usa la caché")
        void paginasYCache() {
            FakeFetcher fetcher = new FakeFetcher(Map.of(
                    "water", new String[] {"https://www.ldoceonline.com/dictionary/water", ENTRY_PAGE},
                    "watre", new String[] {"https://www.ldoceonline.com/spellcheck/english/?q=watre", SPELLCHECK_PAGE}));
            LdoceClient client = client(fetcher, "c.json");

            LdoceLookup found = client.lookup("Water ");
            assertThat(found.status()).isEqualTo("found");
            assertThat(found.entries().getFirst().pronBrE()).isEqualTo("ˈwɔːtə");

            LdoceLookup suggestions = client.lookup("watre");
            assertThat(suggestions.status()).isEqualTo("suggestions");
            assertThat(suggestions.suggestions()).containsExactly("watered", "water");

            LdoceLookup again = client.lookup("water");
            assertThat(again.fromCache()).isTrue();
            assertThat(fetcher.calls).hasSize(2);
        }

        @Test
        @DisplayName("si Longman no responde devuelve \"offline\" sin guardar en caché")
        void offline() {
            FakeFetcher fetcher = new FakeFetcher(Map.of());
            LdoceClient client = client(fetcher, "d.json");
            assertThat(client.lookup("zzz").status()).isEqualTo("offline");
            assertThat(client.lookup("zzz").status()).isEqualTo("offline");
            assertThat(fetcher.calls).hasSize(2);
        }

        @Test
        @DisplayName("rechaza audios que no son de Longman")
        void audiosAjenos() {
            LdoceClient client = client(new FakeFetcher(Map.of()), "e.json");
            assertThatThrownBy(() -> client.audio("https://example.com/media/x.mp3"))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> client.audio("https://www.ldoceonline.com/dictionary/cat"))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> client.audio("https://www.ldoceonline.com/media/../dictionary/x.mp3"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("guarda la caché con el formato de la versión TypeScript y la vuelve a leer")
        void formatoDeLaCache() throws Exception {
            FakeFetcher fetcher = new FakeFetcher(Map.of(
                    "water", new String[] {"https://www.ldoceonline.com/dictionary/water", ENTRY_PAGE}));
            Path file = tempDir.resolve("cache.json");
            LdoceCache cache = new LdoceCache(file, TestFiles.JSON, clock);
            new LdoceClient(fetcher, cache, new AudioCache(tempDir.resolve("a")), 0, clock).lookup("water");
            cache.close();

            String saved = Files.readString(file, StandardCharsets.UTF_8);
            assertThat(saved).startsWith("{\"version\":1,\"lookups\":{\"water\":{\"query\":\"water\",\"status\":\"found\"");
            assertThat(saved).contains("\"fetchedAt\":\"2026-10-16T12:00:00.000Z\",\"parserVersion\":3}");
            assertThat(new LdoceCache(file, TestFiles.JSON, clock).get("water").entries()).hasSize(2);
        }

        @Test
        @DisplayName("lee una caché escrita por la versión TypeScript; descarta las de otra versión del parser o vencidas")
        void leeCacheVieja() throws Exception {
            Path file = tempDir.resolve("vieja.json");
            Files.writeString(file, """
                    {"version":1,"lookups":{
                      "cat":{"query":"cat","status":"found","entries":[{"headword":"cat","pos":"noun","pronBrE":"kæt"}],\
                    "suggestions":[],"pageUrl":"https://www.ldoceonline.com/dictionary/cat","fetchedAt":"2026-09-01T10:00:00.000Z","parserVersion":3},
                      "dog":{"query":"dog","status":"found","entries":[{"headword":"dog","pronBrE":"dɒɡ"}],"suggestions":[],\
                    "fetchedAt":"2026-09-01T10:00:00.000Z","parserVersion":2},
                      "old":{"query":"old","status":"found","entries":[{"headword":"old","pronBrE":"əʊld"}],"suggestions":[],\
                    "fetchedAt":"2025-01-01T10:00:00.000Z","parserVersion":3}}}""", StandardCharsets.UTF_8);
            LdoceCache cache = new LdoceCache(file, TestFiles.JSON, clock);
            assertThat(cache.get("cat").entries().getFirst().pronBrE()).isEqualTo("kæt");
            assertThat(cache.get("dog")).as("otra versión del parser").isNull();
            assertThat(cache.get("old")).as("más de 180 días").isNull();
            assertThat(cache.all()).as("al iniciar se cargan todas en el léxico").hasSize(3);
        }

        @Test
        @DisplayName("una caché rota no impide arrancar")
        void cacheRota() throws Exception {
            Path file = tempDir.resolve("rota.json");
            Files.writeString(file, "{esto no es json", StandardCharsets.UTF_8);
            assertThat(new LdoceCache(file, TestFiles.JSON, clock).all()).isEmpty();
        }

        @Test
        @DisplayName("codifica la búsqueda como encodeURIComponent")
        void codificaLaBusqueda() {
            assertThat(LdoceClient.encodeUriComponent("ice cream")).isEqualTo("ice%20cream");
            assertThat(LdoceClient.encodeUriComponent("don't (x)!*~")).isEqualTo("don't%20(x)!*~");
            assertThat(LdoceClient.encodeUriComponent("café")).isEqualTo("caf%C3%A9");
        }
    }
}
