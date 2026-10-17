package com.dmc00.fonetica.core;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Operaciones de texto con la misma semántica que JavaScript, para que el motor dé exactamente las
 * mismas respuestas que la versión TypeScript que reemplaza (los tests de paridad lo verifican).
 *
 * <p>Diferencias que cubre: el {@code \s} y el {@code trim()} de JavaScript incluyen espacios Unicode
 * (espacio duro U+00A0, U+FEFF...) que el {@code \s} y el {@code strip()} de Java no tratan igual; y
 * las mayúsculas/minúsculas siempre sin depender del idioma de la máquina.
 */
public final class JsStrings {

    /** Clase de caracteres equivalente a {@code \s} de JavaScript, para usar dentro de una regex. */
    public static final String SPACE =
            "[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]";

    private static final Pattern SPACES = Pattern.compile(SPACE + "+");
    private static final Pattern EDGES = Pattern.compile("^" + SPACE + "+|" + SPACE + "+\\z");

    private JsStrings() {
    }

    /** {@code text.trim()} de JavaScript. */
    public static String trim(String text) {
        return EDGES.matcher(text).replaceAll("");
    }

    /** {@code text.replace(/\s+/g, ' ')}. */
    public static String collapseSpaces(String text) {
        return SPACES.matcher(text).replaceAll(" ");
    }

    public static String lower(String text) {
        return text.toLowerCase(Locale.ROOT);
    }

    /** Un texto "verdadero" en JavaScript: ni ausente ni vacío. */
    public static boolean truthy(String text) {
        return text != null && !text.isEmpty();
    }

    /** {@code text.replace(from, to)} de JavaScript: reemplaza sólo la primera aparición, sin regex. */
    public static String replaceFirstLiteral(String text, String from, String to) {
        int at = text.indexOf(from);
        return at < 0 ? text : text.substring(0, at) + to + text.substring(at + from.length());
    }

    /** {@code text.slice(0, maxLength)}. */
    public static String limit(String text, int maxLength) {
        return text.length() <= maxLength ? text : text.substring(0, maxLength);
    }

    /**
     * El orden de {@code a.localeCompare(b)} (ICU, reglas raíz de CLDR) para lo que aparece en las palabras
     * del diccionario: letras, dígitos, espacios y signos. El {@code Collator} de Java ignora el guion y el
     * apóstrofo ("co-op" quedaría después de "cocoa"); ICU los ordena antes que las letras.
     *
     * <p>Tres niveles, como ICU: primero la letra base sin distinguir mayúsculas ni acentos, después los
     * acentos (sin acento primero) y por último las mayúsculas (minúscula primero).
     */
    public static final Comparator<String> LOCALE_ORDER = JsStrings::localeCompare;

    /** Signos en el orden de las reglas raíz de CLDR; todos van antes que los dígitos y las letras. */
    private static final String PUNCTUATION_ORDER = "_-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";

    private static int localeCompare(String a, String b) {
        String da = Normalizer.normalize(a, Normalizer.Form.NFD);
        String db = Normalizer.normalize(b, Normalizer.Form.NFD);
        int primary = compareKeys(baseChars(da), baseChars(db));
        if (primary != 0) return primary;
        int secondary = compareKeys(accents(da), accents(db));
        if (secondary != 0) return secondary;
        return compareKeys(caseKeys(da), caseKeys(db));
    }

    /** Peso principal de cada carácter que no es un acento combinado. */
    private static List<Integer> baseChars(String decomposed) {
        List<Integer> keys = new ArrayList<>();
        decomposed.codePoints().filter(c -> !isCombiningMark(c)).forEach(c -> keys.add(primaryWeight(c)));
        return keys;
    }

    private static int primaryWeight(int c) {
        if (Character.isWhitespace(c) || Character.isSpaceChar(c)) return 0;
        int punctuation = PUNCTUATION_ORDER.indexOf(c);
        if (punctuation >= 0) return 1 + punctuation;
        if (Character.isDigit(c)) return 100 + Character.digit(c, 10);
        if (Character.isLetter(c)) return 1000 + Character.toLowerCase(c);
        return 200_000 + c;
    }

    /** Por cada carácter base, sus acentos (0 = ninguno). */
    private static List<Integer> accents(String decomposed) {
        List<Integer> keys = new ArrayList<>();
        decomposed.codePoints().forEach(c -> {
            if (isCombiningMark(c) && !keys.isEmpty()) keys.set(keys.size() - 1, keys.getLast() * 31 + c);
            else keys.add(0);
        });
        return keys;
    }

    /** Minúscula (0) antes que mayúscula (1). */
    private static List<Integer> caseKeys(String decomposed) {
        List<Integer> keys = new ArrayList<>();
        decomposed.codePoints().filter(c -> !isCombiningMark(c)).forEach(c -> keys.add(Character.isUpperCase(c) ? 1 : 0));
        return keys;
    }

    private static boolean isCombiningMark(int c) {
        return Character.getType(c) == Character.NON_SPACING_MARK;
    }

    private static int compareKeys(List<Integer> a, List<Integer> b) {
        for (int i = 0; i < Math.min(a.size(), b.size()); i++) {
            int diff = Integer.compare(a.get(i), b.get(i));
            if (diff != 0) return diff;
        }
        return Integer.compare(a.size(), b.size());
    }
}
