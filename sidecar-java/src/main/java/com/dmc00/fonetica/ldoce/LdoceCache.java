package com.dmc00.fonetica.ldoce;

import com.dmc00.fonetica.api.LdoceEntry;
import com.dmc00.fonetica.api.LdoceLookup;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import tools.jackson.databind.ObjectMapper;

/**
 * Caché en disco de las consultas a Longman ({@code ldoce-cache.json} en la carpeta de datos del
 * usuario). Cada palabra se pide a Longman una sola vez: después funciona sin conexión y no se le genera
 * tráfico innecesario al sitio.
 *
 * <p>El formato es el mismo que escribía la versión TypeScript ({@code {"version":1,"lookups":{...}}}), así
 * que la caché que ya tiene cada usuario se sigue usando.
 */
public class LdoceCache implements AutoCloseable {

    /** Una consulta tal como se guarda: sin {@code fromCache} ni {@code message}, con la versión del parser. */
    public record StoredLookup(
            String query,
            String status,
            List<LdoceEntry> entries,
            List<String> suggestions,
            String pageUrl,
            String fetchedAt,
            Integer parserVersion) {

        public LdoceLookup toLookup(boolean fromCache) {
            return new LdoceLookup(query, status, entries == null ? List.of() : entries,
                    suggestions == null ? List.of() : suggestions, pageUrl, fetchedAt, fromCache, null);
        }

        static StoredLookup of(LdoceLookup lookup, int parserVersion) {
            return new StoredLookup(lookup.query(), lookup.status(), lookup.entries(), lookup.suggestions(),
                    lookup.pageUrl(), lookup.fetchedAt(), parserVersion);
        }
    }

    record CacheFile(int version, Map<String, StoredLookup> lookups) {
    }

    /** Pasado este tiempo se vuelve a consultar (las pronunciaciones casi no cambian). */
    private static final Duration MAX_AGE = Duration.ofDays(180);
    /** Se guarda medio segundo después del último cambio. */
    private static final long SAVE_DELAY_MS = 500;

    private final Path file;
    private final ObjectMapper json;
    private final Clock clock;
    private final Map<String, StoredLookup> lookups = new LinkedHashMap<>();
    private final ScheduledExecutorService saver = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ldoce-cache");
        thread.setDaemon(true);
        return thread;
    });
    private ScheduledFuture<?> pendingSave;

    public LdoceCache(Path file, ObjectMapper json, Clock clock) {
        this.file = file;
        this.json = json;
        this.clock = clock;
        try {
            if (Files.exists(file)) {
                CacheFile parsed = json.readValue(Files.readString(file, StandardCharsets.UTF_8), CacheFile.class);
                if (parsed != null && parsed.version() == 1 && parsed.lookups() != null) lookups.putAll(parsed.lookups());
            }
        } catch (IOException | RuntimeException e) {
            // Caché corrupta: se empieza de cero, no es información que se pierda.
            lookups.clear();
        }
    }

    /** La consulta guardada, si es de esta versión del parser y no venció; null si no. */
    public synchronized StoredLookup get(String query) {
        StoredLookup hit = lookups.get(query);
        if (hit == null || hit.parserVersion() == null || hit.parserVersion() != LdoceParser.PARSER_VERSION) {
            return null;
        }
        if (hit.fetchedAt() != null && isOlderThanMaxAge(hit.fetchedAt())) return null;
        return hit;
    }

    private boolean isOlderThanMaxAge(String fetchedAt) {
        try {
            return Duration.between(Instant.parse(fetchedAt), clock.instant()).compareTo(MAX_AGE) > 0;
        } catch (DateTimeParseException e) {
            return false; // como Date.parse inválido en JavaScript: la comparación da falso y la consulta sigue valiendo
        }
    }

    public synchronized void set(String query, LdoceLookup lookup) {
        lookups.put(query, StoredLookup.of(lookup, LdoceParser.PARSER_VERSION));
        scheduleSave();
    }

    /** Todas las consultas guardadas, de cualquier versión (al iniciar se cargan en el léxico). */
    public synchronized List<StoredLookup> all() {
        return new ArrayList<>(lookups.values());
    }

    private void scheduleSave() {
        if (pendingSave != null) pendingSave.cancel(false);
        pendingSave = saver.schedule(this::flush, SAVE_DELAY_MS, TimeUnit.MILLISECONDS);
    }

    /** Escribe primero un temporal y lo renombra, así un corte a mitad de camino no deja el archivo roto. */
    public synchronized void flush() {
        if (pendingSave != null) pendingSave.cancel(false);
        pendingSave = null;
        try {
            Files.createDirectories(file.toAbsolutePath().getParent());
            Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(tmp, json.writeValueAsString(new CacheFile(1, lookups)), StandardCharsets.UTF_8);
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            System.getLogger(LdoceCache.class.getName())
                    .log(System.Logger.Level.WARNING, "No se pudo guardar la caché de Longman", e);
        }
    }

    /** Guarda lo pendiente y apaga el temporizador. */
    @Override
    public void close() {
        flush();
        saver.shutdownNow();
    }
}
