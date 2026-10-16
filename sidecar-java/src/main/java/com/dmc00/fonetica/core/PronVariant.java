package com.dmc00.fonetica.core;

import java.util.List;

/**
 * Una pronunciación lista para comparar: la secuencia de fonemas sin marcas de acento y el número de
 * vocal (0, 1, 2...) que lleva el acento principal ({@code null} si no tiene).
 *
 * <p>Se guarda el acento como "qué vocal" y no como posición de la marca porque cada fuente la pone en
 * un lugar distinto (Longman antes de la sílaba, Britfone pegada a la vocal).
 */
public record PronVariant(List<String> segments, Integer stressedVowel) {

    public String key() {
        return String.join(" ", segments);
    }
}
