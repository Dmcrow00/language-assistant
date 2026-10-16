package com.dmc00.fonetica.ldoce;

import com.dmc00.fonetica.api.LdoceEntry;
import com.dmc00.fonetica.api.LdoceLookup;
import com.dmc00.fonetica.core.JsStrings;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Consulta a Longman Dictionary of Contemporary English Online.
 *
 * <p>Longman no tiene una API pública (la de Pearson se dio de baja), así que se lee la misma página que
 * vería el alumno en el navegador, sólo cuando el alumno busca una palabra:
 * <ul>
 *   <li>una consulta por vez y como mínimo un segundo entre consultas;</li>
 *   <li>todo queda en caché, cada palabra se pide una sola vez;</li>
 *   <li>nunca se recorre el diccionario entero.</li>
 * </ul>
 */
public class LdoceClient {

    public static final String LDOCE_ORIGIN = "https://www.ldoceonline.com";

    private static final DateTimeFormatter ISO_MILLIS =
            DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).withZone(ZoneOffset.UTC);

    private final Fetcher fetcher;
    private final LdoceCache cache;
    private final AudioCache audioCache;
    private final long minIntervalMs;
    private final Clock clock;
    /** Justa: los pedidos salen en el orden en que llegaron. */
    private final ReentrantLock queue = new ReentrantLock(true);
    private long lastRequestAt;

    public LdoceClient(Fetcher fetcher, LdoceCache cache, AudioCache audioCache, long minIntervalMs, Clock clock) {
        this.fetcher = fetcher;
        this.cache = cache;
        this.audioCache = audioCache;
        this.minIntervalMs = minIntervalMs;
        this.clock = clock;
    }

    /** Lo que ya se consultó antes, sin ir a la red (null si nunca se pidió). */
    public LdoceLookup cached(String rawQuery) {
        LdoceCache.StoredLookup hit = cache.get(normalizeQuery(rawQuery));
        return hit == null ? null : hit.toLookup(true);
    }

    public LdoceLookup lookup(String rawQuery) {
        String query = normalizeQuery(rawQuery);
        LdoceCache.StoredLookup cached = cache.get(query);
        if (cached != null) return cached.toLookup(true);

        try {
            // "direct" redirige a /dictionary/<palabra> si existe, o a /spellcheck/ con sugerencias.
            String url = LDOCE_ORIGIN + "/search/english/direct/?q=" + encodeUriComponent(query);
            Fetcher.Response response = throttled(() -> fetcher.fetch(url, Map.of("Accept-Language", "en-GB,en;q=0.8")));
            if (!response.ok()) {
                return offline(query, "Longman respondió con el código " + response.status() + ".");
            }
            String html = response.text();
            String finalUrl = JsStrings.truthy(response.url()) ? response.url() : url;
            String fetchedAt = ISO_MILLIS.format(clock.instant());

            // Se decide por el contenido y no por la URL final: no todas las implementaciones de fetch
            // informan a dónde redirigió Longman.
            List<LdoceEntry> entries = finalUrl.contains("/spellcheck/") ? List.of() : LdoceParser.parseEntryPage(html);
            LdoceLookup lookup;
            if (!entries.isEmpty()) {
                lookup = new LdoceLookup(query, "found", entries, List.of(), finalUrl, fetchedAt, false, null);
            } else {
                List<String> suggestions = LdoceParser.parseSpellcheckPage(html);
                lookup = new LdoceLookup(query, suggestions.isEmpty() ? "not-found" : "suggestions", List.of(),
                        suggestions, null, fetchedAt, false, null);
            }
            // "No encontrada" no se guarda: es barato volver a preguntar y evita arrastrar un error de lectura.
            if (!lookup.status().equals("not-found")) cache.set(query, lookup);
            return lookup;
        } catch (IOException | RuntimeException e) {
            return offline(query, messageOf(e));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return offline(query, messageOf(e));
        }
    }

    /** Sólo se aceptan audios del propio Longman: el renderer no puede pedir URLs arbitrarias. */
    public byte[] audio(String rawUrl) throws IOException, InterruptedException {
        URI url = parseUrl(rawUrl);
        String path = url.getRawPath() == null ? "" : url.getRawPath();
        if (!originOf(url).equals(LDOCE_ORIGIN) || !path.startsWith("/media/") || !path.endsWith(".mp3")) {
            throw new IllegalArgumentException("URL de audio no permitida");
        }
        byte[] cached = audioCache.read(url);
        if (cached != null) return cached;
        Fetcher.Response response = throttled(() -> fetcher.fetch(url.toString(), Map.of()));
        if (!response.ok()) {
            throw new IOException("No se pudo descargar el audio (código " + response.status() + ").");
        }
        audioCache.write(url, response.body());
        return response.body();
    }

    private interface Request {
        Fetcher.Response run() throws IOException, InterruptedException;
    }

    /** Los pedidos salen de a uno y con el intervalo mínimo entre sí. */
    private Fetcher.Response throttled(Request request) throws IOException, InterruptedException {
        queue.lock();
        try {
            long wait = lastRequestAt + minIntervalMs - clock.millis();
            if (wait > 0) Thread.sleep(wait);
            try {
                return request.run();
            } finally {
                lastRequestAt = clock.millis();
            }
        } finally {
            queue.unlock();
        }
    }

    /** Como {@code new URL(...)} de JavaScript: resuelve "." y ".." y rechaza lo que no es una URL absoluta. */
    private static URI parseUrl(String rawUrl) {
        try {
            URI url = new URI(rawUrl).normalize();
            if (url.getScheme() == null || url.getHost() == null) throw new IllegalArgumentException("Invalid URL");
            return url;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Invalid URL", e);
        }
    }

    private static String originOf(URI url) {
        String scheme = url.getScheme().toLowerCase(Locale.ROOT);
        int defaultPort = scheme.equals("https") ? 443 : scheme.equals("http") ? 80 : -1;
        String port = url.getPort() == -1 || url.getPort() == defaultPort ? "" : ":" + url.getPort();
        return scheme + "://" + url.getHost().toLowerCase(Locale.ROOT) + port;
    }

    private static String normalizeQuery(String query) {
        return JsStrings.collapseSpaces(JsStrings.lower(JsStrings.trim(query)));
    }

    /** {@code encodeURIComponent} de JavaScript (URLEncoder de Java es otra cosa: codifica formularios). */
    static String encodeUriComponent(String text) {
        StringBuilder out = new StringBuilder();
        for (byte b : text.getBytes(StandardCharsets.UTF_8)) {
            char c = (char) (b & 0xff);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || "-_.!~*'()".indexOf(c) >= 0) {
                out.append(c);
            } else {
                out.append('%').append(String.format("%02X", b & 0xff));
            }
        }
        return out.toString();
    }

    private static String messageOf(Exception e) {
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }

    private static LdoceLookup offline(String query, String message) {
        return new LdoceLookup(query, "offline", List.of(), List.of(), null, null, false, message);
    }
}
