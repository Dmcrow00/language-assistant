package com.dmc00.fonetica.api;

/**
 * Un paso de la comparación entre lo que escribió el alumno y la transcripción del diccionario.
 *
 * @param op       match (coincide), substituted (el diccionario tiene {@code expected} y el alumno escribió
 *                 {@code written}), missing (al alumno le faltó {@code expected}) o extra (el alumno escribió
 *                 {@code written} de más)
 * @param expected el fonema del diccionario; {@code null} en los pasos "extra"
 * @param written  el fonema del alumno; {@code null} en los pasos "missing"
 */
public record AlignmentStep(String op, String expected, String written) {

    public static AlignmentStep match(String expected, String written) {
        return new AlignmentStep("match", expected, written);
    }

    public static AlignmentStep substituted(String expected, String written) {
        return new AlignmentStep("substituted", expected, written);
    }

    public static AlignmentStep missing(String expected) {
        return new AlignmentStep("missing", expected, null);
    }

    public static AlignmentStep extra(String written) {
        return new AlignmentStep("extra", null, written);
    }
}
