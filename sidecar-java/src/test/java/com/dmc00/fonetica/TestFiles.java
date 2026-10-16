package com.dmc00.fonetica;

import com.dmc00.fonetica.core.Lexicon;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Archivos que comparten los tests: el diccionario Britfone del proyecto y los recursos de prueba. */
public final class TestFiles {

    public static final ObjectMapper JSON = Json.mapper();
    private static Lexicon britfone;

    private TestFiles() {
    }

    /** La raíz del repo (la pasa Maven en {@code fonetica.proyecto}; si no, la carpeta padre). */
    public static Path project() {
        String configured = System.getProperty("fonetica.proyecto");
        return Path.of(configured != null ? configured : "..").toAbsolutePath().normalize();
    }

    public static Path resources() {
        return project().resolve("resources");
    }

    /** Un léxico con Britfone cargado, compartido por los tests que no lo modifican. */
    public static synchronized Lexicon britfone() {
        if (britfone == null) britfone = newBritfoneLexicon();
        return britfone;
    }

    /** Un léxico propio, para los tests que le agregan palabras de Longman. */
    public static Lexicon newBritfoneLexicon() {
        Lexicon lexicon = new Lexicon();
        lexicon.loadBritfone(read(resources().resolve("britfone").resolve("britfone.main.3.0.1.csv")));
        return lexicon;
    }

    /** Un recurso de src/test/resources como texto. */
    public static String resource(String name) {
        return read(Path.of("src", "test", "resources").resolve(name));
    }

    public static JsonNode resourceJson(String name) {
        return JSON.readTree(resource(name));
    }

    private static String read(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
