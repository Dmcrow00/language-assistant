package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Corrección de una transcripción del alumno (dictado).
 *
 * @param expected la variante de la transcripción correcta con la que se comparó
 */
public record TranscriptionCheck(boolean exact, double distance, List<AlignmentStep> alignment, String expected) {
}
