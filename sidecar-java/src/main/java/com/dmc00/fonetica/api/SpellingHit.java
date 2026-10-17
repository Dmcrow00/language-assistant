package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Resultado de la búsqueda por ortografía.
 *
 * @param prons  transcripciones en notación Longman; los sonidos opcionales van entre paréntesis
 * @param source "ldoce" (verificada en Longman) o "britfone" (diccionario abierto)
 * @param kind   "exact" (coincide), "prefix" (la palabra empieza así) o "fuzzy" (parecida)
 * @param score  menor es mejor; ordena los resultados
 */
public record SpellingHit(String word, List<String> prons, String source, String kind, double score) {
}
