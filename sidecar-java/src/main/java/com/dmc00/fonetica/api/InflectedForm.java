package com.dmc00.fonetica.api;

/**
 * Pronunciación de una terminación (-s, -ed) y la regla que la explica.
 *
 * @param ending         la terminación pronunciada: "/ɪz/", "/t/"...
 * @param fromDictionary true si la forma está en el diccionario; false si se armó con la regla
 */
public record InflectedForm(String spelling, String pron, String ending, String rule, boolean fromDictionary) {
}
