package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Resultado de la búsqueda por fonemas.
 *
 * @param pron           la variante de pronunciación que más se acercó
 * @param exact          misma secuencia de fonemas (homófonos de lo escrito)
 * @param stressMismatch el alumno marcó el acento principal en otra sílaba (sólo si pidió tenerlo en cuenta)
 */
public record PhonemeMatch(
        String word,
        String pron,
        String source,
        double distance,
        boolean exact,
        boolean stressMismatch,
        List<AlignmentStep> alignment) {
}
