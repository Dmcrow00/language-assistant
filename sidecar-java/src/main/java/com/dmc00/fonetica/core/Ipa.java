package com.dmc00.fonetica.core;

import static com.dmc00.fonetica.core.PhonemeInventory.LENGTH_MARK;
import static com.dmc00.fonetica.core.PhonemeInventory.PRIMARY_STRESS;
import static com.dmc00.fonetica.core.PhonemeInventory.SECONDARY_STRESS;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/** Normalización de la notación y separación de una transcripción en fonemas. */
public final class Ipa {

    /** Resultado de {@link #tokenize}: los fonemas reconocidos y los caracteres que no lo son. */
    public record Tokens(List<String> tokens, List<String> unknown) {
    }

    /** Equivalencias de notación: IPA estricta (Britfone, eSpeak) y tipeo ASCII → notación Longman. */
    private static final String[][] EQUIVALENTS = {
            {"ɛ", "e"},
            {"ɐ", "ʌ"},
            {"ɹ", "r"},
            {"g", "ɡ"},
            {"ɝ", "ɜː"},
            {"ɚ", "ə"},
            {"ʧ", "tʃ"},
            {"ʤ", "dʒ"},
            {"ɫ", "l"},
            {":", LENGTH_MARK},
            {"'", PRIMARY_STRESS},
            {"ʳ", ""}, // r de enlace: no se pronuncia en RP salvo ante vocal
    };

    /** Caracteres que separan pero no son sonidos: espacios, separación silábica, barras. */
    private static final Set<Character> IGNORED = Set.of(' ', '.', '-', '/', '‿', '‧', ' ');

    private static final List<String> SYMBOLS_LONGEST_FIRST = Stream
            .concat(PhonemeInventory.symbols().stream(), Stream.of(PRIMARY_STRESS, SECONDARY_STRESS))
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();

    private Ipa() {
    }

    public static String normalizeIpa(String text) {
        // NFD separa los diacríticos combinados (p. ej. la marca de consonante silábica) para poder descartarlos.
        String result = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("[\\u0300-\\u036f]", "");
        for (String[] equivalent : EQUIVALENTS) {
            result = result.replace(equivalent[0], equivalent[1]);
        }
        return result;
    }

    /**
     * Parte una transcripción en fonemas tomando siempre el símbolo más largo posible, así "aɪ" es un
     * diptongo y no "a" + "ɪ", y "tʃ" es una africada.
     */
    public static Tokens tokenize(String text) {
        String normalized = normalizeIpa(text);
        List<String> tokens = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        int i = 0;
        while (i < normalized.length()) {
            char c = normalized.charAt(i);
            if (IGNORED.contains(c)) {
                i++;
                continue;
            }
            String symbol = PhonemeInventory.longestSymbolAt(normalized, i, SYMBOLS_LONGEST_FIRST);
            if (symbol != null) {
                tokens.add(symbol);
                i += symbol.length();
            } else {
                unknown.add(String.valueOf(c));
                i++;
            }
        }
        return new Tokens(tokens, unknown);
    }

    /** Los fonemas de una transcripción, sin las marcas de acento. */
    public static List<String> phonemes(String pron) {
        return tokenize(pron).tokens().stream()
                .filter(t -> !t.equals(PRIMARY_STRESS) && !t.equals(SECONDARY_STRESS))
                .toList();
    }

    /** Saca las marcas de acento y anota qué vocal lleva el principal. */
    public static PronVariant toVariant(List<String> tokens) {
        List<String> segments = new ArrayList<>();
        int vowelCount = 0;
        boolean pendingPrimary = false;
        Integer stressedVowel = null;
        for (String token : tokens) {
            if (token.equals(PRIMARY_STRESS)) {
                pendingPrimary = true;
                continue;
            }
            if (token.equals(SECONDARY_STRESS)) continue;
            if (PhonemeInventory.isVowel(token)) {
                if (pendingPrimary && stressedVowel == null) stressedVowel = vowelCount;
                pendingPrimary = false;
                vowelCount++;
            }
            segments.add(token);
        }
        return new PronVariant(segments, stressedVowel);
    }
}
