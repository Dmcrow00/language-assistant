package com.dmc00.fonetica.ipc;

import com.dmc00.fonetica.core.JsStrings;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;
import tools.jackson.databind.JsonNode;

/**
 * Validación de lo que llega del renderer: la misma que hace Electron en {@code electron/ipc.ts}. Se repite
 * acá porque el motor no confía en quién le escribe por stdin (ADR-0002).
 */
final class Input {

    private Input() {
    }

    /** Un texto, cortado al largo máximo; si no es texto, error. */
    static String text(JsonNode value, int maxLength) {
        if (value == null || !value.isString()) throw new IllegalArgumentException("Se esperaba un texto");
        return JsStrings.limit(value.asString(), maxLength);
    }

    /** Índices de palabras válidos (enteros entre 0 y 199); lo demás se descarta. */
    static List<Integer> indexes(JsonNode value) {
        List<Integer> result = new ArrayList<>();
        if (value == null || !value.isArray()) return result;
        for (JsonNode item : value) {
            if (isInteger(item) && item.asDouble() >= 0 && item.asDouble() < 200) result.add(item.asInt());
        }
        return result;
    }

    /** Un límite de resultados entre 1 y 100, o el valor por defecto. */
    static int count(JsonNode value, int fallback) {
        return isInteger(value) && value.asDouble() > 0 && value.asDouble() <= 100 ? value.asInt() : fallback;
    }

    /** Los textos de una lista que cumplen la condición, hasta {@code max}. */
    static List<String> strings(JsonNode value, Predicate<String> accepted, int max) {
        List<String> result = new ArrayList<>();
        if (value == null || !value.isArray()) return result;
        for (JsonNode item : value) {
            if (item.isString() && accepted.test(item.asString())) result.add(item.asString());
        }
        return result.size() > max ? new ArrayList<>(result.subList(0, max)) : result;
    }

    /** Fonemas conocidos (y marcas de acento), hasta {@code max}. */
    static List<String> tokens(JsonNode value, Set<String> validTokens, int max) {
        return strings(value, validTokens::contains, max);
    }

    /** {@code value === true}: cualquier otra cosa es false. */
    static boolean isTrue(JsonNode value) {
        return value != null && value.isBoolean() && value.asBoolean();
    }

    /** {@code value !== false}: sólo un false explícito es false. */
    static boolean isNotFalse(JsonNode value) {
        return value == null || !value.isBoolean() || value.asBoolean();
    }

    /** {@code Number.isInteger(value)}: 2 y 2.0 sí; 2.5, "2" o null no. */
    private static boolean isInteger(JsonNode value) {
        if (value == null || !value.isNumber()) return false;
        double number = value.asDouble();
        return Double.isFinite(number) && number == Math.rint(number);
    }
}
