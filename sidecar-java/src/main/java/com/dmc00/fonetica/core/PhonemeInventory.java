package com.dmc00.fonetica.core;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Inventario fonémico del inglés británico RP en la notación de Longman (LDOCE).
 *
 * <p>Longman sigue la tradición de Gimson, que es la que se enseña en los profesorados: /e/ (no /ɛ/),
 * /ʌ/ (no /ɐ/), /r/ (no /ɹ/), /eə/ (no /ɛː/). Las fuentes que usan IPA estricta se convierten a esta
 * notación antes de comparar (ver {@link Ipa}).
 *
 * <p>La interfaz tiene su propia copia en {@code shared/phoneme-inventory.ts} (el teclado en pantalla y
 * la validación de Electron): si se cambia un símbolo, se cambia en los dos lados.
 */
public final class PhonemeInventory {

    public static final String PRIMARY_STRESS = "ˈ";
    public static final String SECONDARY_STRESS = "ˌ";
    public static final String LENGTH_MARK = "ː";

    public enum Category { MONOPHTHONG, DIPHTHONG, WEAK_VOWEL, CONSONANT }

    /**
     * @param keyword conjunto léxico de Wells para las vocales (KIT, DRESS...); para las consonantes, su clase
     * @param example palabra de ejemplo de la tabla fonémica de Underhill / British Council
     */
    public record Phoneme(String symbol, Category category, String keyword, String example) {
    }

    public static final List<Phoneme> PHONEMES = List.of(
            // Monoptongos
            vowel("iː", Category.MONOPHTHONG, "FLEECE", "sheep"),
            vowel("ɪ", Category.MONOPHTHONG, "KIT", "ship"),
            vowel("ʊ", Category.MONOPHTHONG, "FOOT", "good"),
            vowel("uː", Category.MONOPHTHONG, "GOOSE", "shoot"),
            vowel("e", Category.MONOPHTHONG, "DRESS", "bed"),
            vowel("ə", Category.MONOPHTHONG, "COMMA", "teacher"),
            vowel("ɜː", Category.MONOPHTHONG, "NURSE", "bird"),
            vowel("ɔː", Category.MONOPHTHONG, "THOUGHT", "door"),
            vowel("æ", Category.MONOPHTHONG, "TRAP", "cat"),
            vowel("ʌ", Category.MONOPHTHONG, "STRUT", "up"),
            vowel("ɑː", Category.MONOPHTHONG, "PALM", "far"),
            vowel("ɒ", Category.MONOPHTHONG, "LOT", "on"),
            // Diptongos
            vowel("ɪə", Category.DIPHTHONG, "NEAR", "here"),
            vowel("eɪ", Category.DIPHTHONG, "FACE", "wait"),
            vowel("ʊə", Category.DIPHTHONG, "CURE", "tourist"),
            vowel("ɔɪ", Category.DIPHTHONG, "CHOICE", "boy"),
            vowel("əʊ", Category.DIPHTHONG, "GOAT", "show"),
            vowel("eə", Category.DIPHTHONG, "SQUARE", "hair"),
            vowel("aɪ", Category.DIPHTHONG, "PRICE", "my"),
            vowel("aʊ", Category.DIPHTHONG, "MOUTH", "cow"),
            // Vocales débiles que Longman distingue (happY, thankYOU)
            vowel("i", Category.WEAK_VOWEL, "happY", "happy"),
            vowel("u", Category.WEAK_VOWEL, "thankYOU", "situation"),
            // Consonantes, en el orden de la tabla (pares sorda/sonora)
            consonant("p", "plosiva", "pea"),
            consonant("b", "plosiva", "boat"),
            consonant("t", "plosiva", "tea"),
            consonant("d", "plosiva", "dog"),
            consonant("tʃ", "africada", "cheese"),
            consonant("dʒ", "africada", "June"),
            consonant("k", "plosiva", "car"),
            consonant("ɡ", "plosiva", "go"),
            consonant("f", "fricativa", "fly"),
            consonant("v", "fricativa", "video"),
            consonant("θ", "fricativa", "think"),
            consonant("ð", "fricativa", "this"),
            consonant("s", "fricativa", "see"),
            consonant("z", "fricativa", "zoo"),
            consonant("ʃ", "fricativa", "shall"),
            consonant("ʒ", "fricativa", "television"),
            consonant("m", "nasal", "man"),
            consonant("n", "nasal", "now"),
            consonant("ŋ", "nasal", "sing"),
            consonant("h", "fricativa", "hat"),
            consonant("l", "aproximante lateral", "love"),
            consonant("r", "aproximante", "red"),
            consonant("w", "aproximante", "wet"),
            consonant("j", "aproximante", "yes"));

    private static final Set<String> VOWEL_SYMBOLS = PHONEMES.stream()
            .filter(p -> p.category() != Category.CONSONANT)
            .map(Phoneme::symbol)
            .collect(Collectors.toUnmodifiableSet());

    /** Los símbolos de más de un carácter primero, para tomar siempre el más largo ("aɪ" antes que "a"). */
    private static final List<String> SYMBOLS_LONGEST_FIRST = PHONEMES.stream()
            .map(Phoneme::symbol)
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();

    private PhonemeInventory() {
    }

    /** {@code null} (un fonema que no existe) no es vocal. */
    public static boolean isVowel(String symbol) {
        return symbol != null && VOWEL_SYMBOLS.contains(symbol);
    }

    public static List<String> symbols() {
        return PHONEMES.stream().map(Phoneme::symbol).toList();
    }

    static String longestSymbolAt(String text, int index, List<String> symbolsLongestFirst) {
        for (String symbol : symbolsLongestFirst) {
            if (text.startsWith(symbol, index)) return symbol;
        }
        return null;
    }

    private static Phoneme vowel(String symbol, Category category, String keyword, String example) {
        return new Phoneme(symbol, category, keyword, example);
    }

    private static Phoneme consonant(String symbol, String keyword, String example) {
        return new Phoneme(symbol, Category.CONSONANT, keyword, example);
    }
}
