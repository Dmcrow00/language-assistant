package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Opciones de la transcripción de oraciones.
 *
 * @param connected    habla conectada (formas débiles y r de enlace); si es false, cada palabra en su forma de cita
 * @param forcedStrong índices de las palabras que el alumno marcó como enfatizadas (van en forma fuerte)
 * @param forcedWeak   índices de las palabras que el alumno marcó sin énfasis (van en forma débil)
 */
public record SentenceOptions(boolean connected, List<Integer> forcedStrong, List<Integer> forcedWeak) {
}
