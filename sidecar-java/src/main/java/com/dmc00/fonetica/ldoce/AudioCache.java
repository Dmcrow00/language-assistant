package com.dmc00.fonetica.ldoce;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Audios mp3 de Longman guardados en disco, uno por URL (sin el parámetro de versión): el nombre es el
 * SHA-1 de la ruta, igual que en la versión TypeScript, así se aprovechan los audios ya bajados.
 */
public class AudioCache {

    private final Path dir;

    public AudioCache(Path dir) {
        this.dir = dir;
    }

    private Path pathFor(URI url) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-1").digest(url.getRawPath().getBytes(StandardCharsets.UTF_8));
            return dir.resolve(HexFormat.of().formatHex(hash) + ".mp3");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-1 siempre está disponible en la JVM", e);
        }
    }

    /** Los bytes del audio, o null si todavía no se bajó. */
    public byte[] read(URI url) {
        try {
            return Files.readAllBytes(pathFor(url));
        } catch (IOException e) {
            return null;
        }
    }

    public void write(URI url, byte[] bytes) throws IOException {
        Files.createDirectories(dir);
        Files.write(pathFor(url), bytes);
    }
}
