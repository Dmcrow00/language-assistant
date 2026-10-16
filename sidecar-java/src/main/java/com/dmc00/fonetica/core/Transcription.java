package com.dmc00.fonetica.core;

import static com.dmc00.fonetica.core.PhonemeInventory.PRIMARY_STRESS;
import static com.dmc00.fonetica.core.PhonemeInventory.SECONDARY_STRESS;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Transcripciones de Longman → variantes comparables.
 *
 * <p>Longman escribe varias pronunciaciones separadas por coma y abrevia las alternativas:
 * <pre>
 *   "ˈʃedjuːl, ˈske-"     → la segunda reemplaza el comienzo: ˈskedjuːl
 *   "ˈskedʒʊl, -dʒ(ə)l"   → la segunda reemplaza el final:    ˈskedʒəl
 * </pre>
 * Los sonidos opcionales (en cursiva en Longman) se guardan entre paréntesis: ˈɡʌv(ə)mənt.
 */
public final class Transcription {

    private static final Pattern OPTIONAL_PIECE = Pattern.compile("\\([^)]*\\)");
    private static final Pattern BRITFONE_SEPARATOR = Pattern.compile(JsStrings.SPACE + "+");

    /**
     * Grupos de consonantes que pueden iniciar sílaba en inglés. Se usan para correr la marca de acento
     * de Britfone (pegada a la vocal) al comienzo de la sílaba, como en Longman:
     * Britfone "k ə m p j ˈuː t ə" → Longman "kəmˈpjuːtə".
     */
    private static final Set<String> LEGAL_ONSETS = Set.of((
            "pl pr pj bl br bj tr tj tw dr dj dw kl kr kj kw ɡl ɡr ɡj ɡw "
                    + "fl fr fj vj θr θj θw ʃr sp st sk sm sn sl sw sf sj mj nj lj hj "
                    + "spl spr spj str stj skr skw skj").split(" "));

    private Transcription() {
    }

    /** Expande las abreviaturas con guion; devuelve transcripciones completas, todavía con paréntesis. */
    public static List<String> expandLongmanAlternatives(String pron) {
        List<String> parts = new ArrayList<>();
        for (String part : pron.split(",", -1)) {
            String trimmed = JsStrings.trim(part);
            if (!trimmed.isEmpty()) parts.add(trimmed);
        }
        if (parts.isEmpty()) return List.of();
        String base = parts.getFirst().endsWith("-")
                ? parts.getFirst().substring(0, parts.getFirst().length() - 1)
                : parts.getFirst();
        List<String> result = new ArrayList<>(List.of(base));
        for (String part : parts.subList(1, parts.size())) {
            String expanded = expandPartial(base, part);
            if (expanded != null && !result.contains(expanded)) result.add(expanded);
        }
        return result;
    }

    private static String expandPartial(String base, String part) {
        if (part.endsWith("-") && !part.startsWith("-")) {
            // Reemplaza el comienzo: se engancha en la primera aparición del último símbolo de la parte.
            String head = part.substring(0, part.length() - 1);
            String anchor = lastSoundChar(head);
            if (anchor == null) return null;
            int at = base.indexOf(anchor);
            return at < 0 ? null : head + base.substring(at + anchor.length());
        }
        if (part.startsWith("-") && !part.endsWith("-")) {
            // Reemplaza el final: se engancha en la última aparición del primer símbolo de la parte.
            String tail = part.substring(1);
            String anchor = firstSoundChar(tail);
            if (anchor == null) return null;
            int at = base.lastIndexOf(anchor);
            return at < 0 ? null : base.substring(0, at) + tail;
        }
        if (part.contains("-")) return null; // abreviatura en el medio: no la interpretamos
        return part;
    }

    private static String firstSoundChar(String text) {
        return text.codePoints()
                .mapToObj(Character::toString)
                .filter(c -> !"ˈˌ()".contains(c))
                .findFirst()
                .orElse(null);
    }

    private static String lastSoundChar(String text) {
        List<String> chars = text.codePoints().mapToObj(Character::toString).toList();
        for (int i = chars.size() - 1; i >= 0; i--) {
            if (!"ˈˌ()ː".contains(chars.get(i))) return chars.get(i);
        }
        return null;
    }

    /** "ˈɡʌv(ə)mənt" → ["ˈɡʌvəmənt", "ˈɡʌvmənt"]. Como mucho 3 sonidos opcionales (8 combinaciones). */
    public static List<String> expandOptionalSounds(String pron) {
        List<String> results = new ArrayList<>(List.of(""));
        int optionalCount = 0;
        for (String piece : splitKeepingOptional(pron)) {
            boolean optional = piece.startsWith("(") && piece.endsWith(")");
            if (optional && optionalCount < 3) {
                optionalCount++;
                String inner = piece.substring(1, piece.length() - 1);
                List<String> next = new ArrayList<>();
                for (String r : results) {
                    next.add(r + inner);
                    next.add(r);
                }
                results = next;
            } else {
                String text = optional ? piece.substring(1, piece.length() - 1) : piece;
                results.replaceAll(r -> r + text);
            }
        }
        return results;
    }

    /** {@code pron.split(/(\([^)]*\))/).filter(p => p !== '')}: los paréntesis quedan como piezas propias. */
    private static List<String> splitKeepingOptional(String pron) {
        List<String> pieces = new ArrayList<>();
        Matcher m = OPTIONAL_PIECE.matcher(pron);
        int last = 0;
        while (m.find()) {
            if (m.start() > last) pieces.add(pron.substring(last, m.start()));
            pieces.add(m.group());
            last = m.end();
        }
        if (last < pron.length()) pieces.add(pron.substring(last));
        return pieces;
    }

    /** Todas las variantes comparables de una transcripción de Longman, sin repetidos. */
    public static List<PronVariant> parseLongmanPron(String pron) {
        List<PronVariant> variants = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String full : expandLongmanAlternatives(pron)) {
            for (String plain : expandOptionalSounds(full)) {
                PronVariant variant = Ipa.toVariant(Ipa.tokenize(plain).tokens());
                if (!variant.segments().isEmpty() && seen.add(variant.key())) variants.add(variant);
            }
        }
        return variants;
    }

    private static boolean isLegalOnset(List<String> cluster) {
        if (cluster.isEmpty()) return true;
        if (cluster.size() == 1) return !cluster.getFirst().equals("ŋ");
        return LEGAL_ONSETS.contains(String.join("", cluster));
    }

    /**
     * Convierte una pronunciación de Britfone (fonemas separados por espacio, IPA estricta, acento pegado
     * a la vocal) a una cadena en notación Longman.
     */
    public static String britfoneToLongman(String spaceSeparated) {
        List<String> units = new ArrayList<>();
        Map<Integer, String> stressBefore = new LinkedHashMap<>(); // índice de vocal en `units` → marca
        for (String raw : BRITFONE_SEPARATOR.split(JsStrings.trim(spaceSeparated), -1)) {
            String token = Ipa.normalizeIpa(raw);
            String mark = null;
            if (token.startsWith(PRIMARY_STRESS) || token.startsWith(SECONDARY_STRESS)) {
                mark = token.substring(0, 1);
                token = token.substring(1);
            }
            if (token.isEmpty()) continue;
            if (mark != null) stressBefore.put(units.size(), mark);
            units.add(token);
        }

        // Para cada vocal acentuada, la marca va antes del grupo consonántico más largo que pueda iniciar sílaba.
        Map<Integer, String> marksAt = new HashMap<>();
        for (Map.Entry<Integer, String> stressed : stressBefore.entrySet()) {
            int vowelIndex = stressed.getKey();
            int start = vowelIndex;
            while (start > 0 && !PhonemeInventory.isVowel(units.get(start - 1))) start--;
            int onsetStart = start == 0 ? 0 : vowelIndex;
            if (start > 0) {
                for (int s = start; s <= vowelIndex; s++) {
                    if (isLegalOnset(units.subList(s, vowelIndex))) {
                        onsetStart = s;
                        break;
                    }
                }
            }
            marksAt.put(onsetStart, stressed.getValue());
        }

        // Como Longman, los monosílabos van sin marca de acento: "kæt", no "ˈkæt".
        if (units.stream().filter(PhonemeInventory::isVowel).count() == 1) marksAt.clear();

        StringBuilder out = new StringBuilder();
        for (int i = 0; i < units.size(); i++) {
            out.append(marksAt.getOrDefault(i, "")).append(units.get(i));
        }
        return out.toString();
    }
}
