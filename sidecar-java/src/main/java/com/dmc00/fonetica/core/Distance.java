package com.dmc00.fonetica.core;

import com.dmc00.fonetica.api.AlignmentStep;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Distancias para encontrar "lo más parecido".
 *
 * <ul>
 *   <li>Ortografía: distancia de Damerau-Levenshtein restringida (OSA): cada letra cambiada, agregada,
 *       borrada o dos letras invertidas ("watre" → "water") cuesta 1.</li>
 *   <li>Fonemas: distancia de edición con costos según cuán parecidos suenan. Confundir /ɪ/ con /iː/
 *       cuesta menos que confundir /ɪ/ con /ɑː/; agregar una /r/ (error típico de hablantes de variedades
 *       róticas) cuesta poco. Los valores están en tablas para poder ajustarlos.</li>
 * </ul>
 */
public final class Distance {

    /** Pares de fonemas que se confunden con facilidad y cuánto cuesta cambiar uno por otro (0–1). */
    private static final Object[][] SIMILAR_PAIRS = {
            // Vocales: largas/cortas y vecinas en el trapecio vocálico
            {"ɪ", "iː", 0.4}, {"ɪ", "i", 0.3}, {"i", "iː", 0.3},
            {"ʊ", "uː", 0.4}, {"ʊ", "u", 0.3}, {"u", "uː", 0.3},
            {"æ", "e", 0.5}, {"æ", "ʌ", 0.5}, {"ʌ", "ɑː", 0.5}, {"æ", "ɑː", 0.6},
            {"ɒ", "ɔː", 0.5}, {"ɒ", "ʌ", 0.6}, {"ɒ", "ɑː", 0.6},
            {"ə", "ʌ", 0.4}, {"ə", "ɜː", 0.5}, {"ə", "ɪ", 0.5}, {"ə", "i", 0.6}, {"ə", "e", 0.6},
            {"ə", "ʊ", 0.6}, {"ə", "u", 0.6},
            {"ɜː", "e", 0.7}, {"ɜː", "ʌ", 0.7},
            // Diptongos y su vocal más cercana
            {"eɪ", "e", 0.5}, {"eɪ", "iː", 0.7}, {"aɪ", "eɪ", 0.6}, {"aɪ", "æ", 0.7}, {"aɪ", "ɑː", 0.7},
            {"ɔɪ", "ɔː", 0.7}, {"əʊ", "ɒ", 0.6}, {"əʊ", "ɔː", 0.6}, {"əʊ", "uː", 0.7},
            {"aʊ", "əʊ", 0.6}, {"aʊ", "ɑː", 0.7}, {"ɪə", "iː", 0.6}, {"ɪə", "ɪ", 0.6},
            {"eə", "e", 0.5}, {"eə", "ɜː", 0.7}, {"ʊə", "ɔː", 0.4}, {"ʊə", "uː", 0.6}, {"ʊə", "ʊ", 0.6},
            // Consonantes: pares sorda/sonora
            {"p", "b", 0.4}, {"t", "d", 0.4}, {"k", "ɡ", 0.4}, {"f", "v", 0.4}, {"θ", "ð", 0.3},
            {"s", "z", 0.4}, {"ʃ", "ʒ", 0.4}, {"tʃ", "dʒ", 0.4},
            // Consonantes: punto o modo de articulación cercano
            {"θ", "t", 0.5}, {"ð", "d", 0.5}, {"θ", "f", 0.6}, {"ð", "v", 0.6}, {"θ", "s", 0.6},
            {"ð", "z", 0.6}, {"s", "ʃ", 0.5}, {"z", "ʒ", 0.5}, {"tʃ", "ʃ", 0.5}, {"dʒ", "ʒ", 0.5},
            {"dʒ", "j", 0.6}, {"tʃ", "t", 0.6}, {"dʒ", "d", 0.6}, {"b", "v", 0.5}, {"w", "v", 0.6},
            {"m", "n", 0.6}, {"n", "ŋ", 0.4}, {"l", "r", 0.7}, {"r", "w", 0.7},
    };

    private static final double DEFAULT_VOWEL_VOWEL = 0.85;
    private static final double DEFAULT_CONSONANT_CONSONANT = 0.9;
    private static final double VOWEL_CONSONANT = 1.3;
    private static final double DEFAULT_INDEL = 1;

    /** Fonemas que se agregan u omiten seguido sin cambiar mucho la palabra. */
    private static final Map<String, Double> INDEL_COST = Map.of(
            "ə", 0.5, // elisión de schwa: ˈɡʌv(ə)mənt
            "r", 0.5, // /r/ final o preconsonántica que el RP no pronuncia
            "j", 0.6, // yod: /njuː/ ~ /nuː/
            "h", 0.7,
            "i", 0.7,
            "u", 0.7);

    private static final double MIN_INDEL = Math.min(DEFAULT_INDEL, Collections.min(INDEL_COST.values()));

    private static final Map<String, Double> PAIR_COST = new HashMap<>();

    static {
        for (Object[] pair : SIMILAR_PAIRS) {
            PAIR_COST.put(pair[0] + "|" + pair[1], (Double) pair[2]);
            PAIR_COST.put(pair[1] + "|" + pair[0], (Double) pair[2]);
        }
    }

    private Distance() {
    }

    /** Distancia OSA entre dos palabras; si supera {@code max} devuelve {@code max + 1} sin terminar la cuenta. */
    public static int osaDistance(String a, String b, int max) {
        if (Math.abs(a.length() - b.length()) > max) return max + 1;
        int rows = a.length() + 1;
        int cols = b.length() + 1;
        int[][] d = new int[rows][cols];
        for (int i = 0; i < rows; i++) d[i][0] = i;
        for (int j = 0; j < cols; j++) d[0][j] = j;
        for (int i = 1; i < rows; i++) {
            int rowMin = Integer.MAX_VALUE;
            for (int j = 1; j < cols; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                int value = Math.min(Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
                if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) {
                    value = Math.min(value, d[i - 2][j - 2] + 1);
                }
                d[i][j] = value;
                rowMin = Math.min(rowMin, value);
            }
            if (rowMin > max) return max + 1;
        }
        return d[a.length()][b.length()];
    }

    public static double substitutionCost(String a, String b) {
        if (a.equals(b)) return 0;
        Double known = PAIR_COST.get(a + "|" + b);
        if (known != null) return known;
        boolean va = PhonemeInventory.isVowel(a);
        boolean vb = PhonemeInventory.isVowel(b);
        if (va && vb) return DEFAULT_VOWEL_VOWEL;
        if (!va && !vb) return DEFAULT_CONSONANT_CONSONANT;
        return VOWEL_CONSONANT;
    }

    public static double indelCost(String phoneme) {
        return INDEL_COST.getOrDefault(phoneme, DEFAULT_INDEL);
    }

    /** Sin límite: la distancia completa. */
    public static double phonemeDistance(List<String> written, List<String> expected) {
        return phonemeDistance(written, expected, Double.POSITIVE_INFINITY);
    }

    /**
     * Distancia entre lo que escribió el alumno y una transcripción. Corta antes si ya se pasó de
     * {@code max} (devuelve infinito): así recorrer 16 000 palabras es instantáneo.
     */
    public static double phonemeDistance(List<String> written, List<String> expected, double max) {
        if (Math.abs(written.size() - expected.size()) * MIN_INDEL > max) return Double.POSITIVE_INFINITY;
        double[] previous = new double[expected.size() + 1];
        double[] current = new double[expected.size() + 1];
        previous[0] = 0;
        for (int j = 1; j <= expected.size(); j++) previous[j] = previous[j - 1] + indelCost(expected.get(j - 1));
        for (int i = 1; i <= written.size(); i++) {
            current[0] = previous[0] + indelCost(written.get(i - 1));
            double rowMin = current[0];
            for (int j = 1; j <= expected.size(); j++) {
                current[j] = Math.min(Math.min(
                                previous[j] + indelCost(written.get(i - 1)), // el alumno escribió de más
                                current[j - 1] + indelCost(expected.get(j - 1))), // al alumno le faltó
                        previous[j - 1] + substitutionCost(written.get(i - 1), expected.get(j - 1)));
                rowMin = Math.min(rowMin, current[j]);
            }
            if (rowMin > max) return Double.POSITIVE_INFINITY;
            double[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[expected.size()];
    }

    /** Resultado de {@link #phonemeAlignment}. */
    public record Alignment(double distance, List<AlignmentStep> steps) {
    }

    /** Igual que {@link #phonemeDistance} pero además devuelve el paso a paso para mostrar qué no coincidió. */
    public static Alignment phonemeAlignment(List<String> written, List<String> expected) {
        int n = written.size();
        int m = expected.size();
        double[][] d = new double[n + 1][m + 1];
        for (int i = 1; i <= n; i++) d[i][0] = d[i - 1][0] + indelCost(written.get(i - 1));
        for (int j = 1; j <= m; j++) d[0][j] = d[0][j - 1] + indelCost(expected.get(j - 1));
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                d[i][j] = Math.min(Math.min(
                                d[i - 1][j] + indelCost(written.get(i - 1)),
                                d[i][j - 1] + indelCost(expected.get(j - 1))),
                        d[i - 1][j - 1] + substitutionCost(written.get(i - 1), expected.get(j - 1)));
            }
        }

        List<AlignmentStep> steps = new ArrayList<>();
        int i = n;
        int j = m;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0
                    && same(d[i][j], d[i - 1][j - 1] + substitutionCost(written.get(i - 1), expected.get(j - 1)))) {
                String w = written.get(i - 1);
                String e = expected.get(j - 1);
                steps.add(w.equals(e) ? AlignmentStep.match(e, w) : AlignmentStep.substituted(e, w));
                i--;
                j--;
            } else if (j > 0 && same(d[i][j], d[i][j - 1] + indelCost(expected.get(j - 1)))) {
                steps.add(AlignmentStep.missing(expected.get(j - 1)));
                j--;
            } else {
                steps.add(AlignmentStep.extra(written.get(i - 1)));
                i--;
            }
        }
        return new Alignment(d[n][m], steps.reversed());
    }

    private static boolean same(double x, double y) {
        return Math.abs(x - y) < 1e-9;
    }
}
