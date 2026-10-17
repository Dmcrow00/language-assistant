package com.dmc00.fonetica.core;

import com.dmc00.fonetica.api.ConnectedProcess;
import com.dmc00.fonetica.api.SentenceWord;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Procesos del habla conectada entre palabras (Roach, cap. 14), todos optativos en RP:
 *
 * <ul>
 *   <li>r de enlace (far‿away) y r intrusiva (law and order /lɔːr ənd/).</li>
 *   <li>Elisión de /t/ y /d/ entre consonantes: next day /neks deɪ/.</li>
 *   <li>Asimilación de lugar de /t d n/ final: ten boys /tem bɔɪz/, that cat /ðæk kæt/; y de /s z/ ante /ʃ/:
 *       this shop /ðɪʃ ʃɒp/.</li>
 *   <li>Coalescencia con /j/: don't you /dəʊntʃu/, would you /wʊdʒu/.</li>
 * </ul>
 * Marca cada proceso y deja en {@code connectedPron} la transcripción con el proceso aplicado.
 */
public final class ConnectedSpeech {

    private static final Set<String> R_VOWELS = Set.of("ə", "ɑː", "ɔː", "ɜː", "ɪə", "eə", "ʊə");
    private static final Set<String> BILABIAL = Set.of("p", "b", "m");
    private static final Set<String> VELAR = Set.of("k", "ɡ");
    private static final Map<String, String> TO_BILABIAL = Map.of("t", "p", "d", "b", "n", "m");
    private static final Map<String, String> TO_VELAR = Map.of("t", "k", "d", "ɡ", "n", "ŋ");
    private static final Map<String, String> COALESCENCE = Map.of("t", "tʃ", "d", "dʒ", "s", "ʃ", "z", "ʒ");
    /** La palabra termina en "r" o "re" escrita: entonces la /r/ es de enlace, no intrusiva. */
    static final Pattern WRITTEN_FINAL_R = Pattern.compile("r(e)?\\z", Pattern.CASE_INSENSITIVE);

    private ConnectedSpeech() {
    }

    /** Reemplaza el último fonema de la transcripción (respetando acentos y paréntesis previos). */
    private static String replaceLast(String pron, String from, String to) {
        int at = pron.lastIndexOf(from);
        return at < 0 ? pron : pron.substring(0, at) + to + pron.substring(at + from.length());
    }

    /** Reemplaza el primer fonema (después de una posible marca de acento). */
    private static String replaceFirst(String pron, String from, String to) {
        int offset = pron.startsWith("ˈ") || pron.startsWith("ˌ") ? 1 : 0;
        return pron.startsWith(from, offset)
                ? pron.substring(0, offset) + to + pron.substring(offset + from.length())
                : pron;
    }

    private static String last(List<String> list, int fromEnd) {
        int index = list.size() - fromEnd;
        return index >= 0 && index < list.size() ? list.get(index) : null;
    }

    public static List<ConnectedProcess> detectProcesses(List<SentenceWord> words) {
        List<ConnectedProcess> processes = new ArrayList<>();
        List<String> current = new ArrayList<>();
        for (SentenceWord w : words) current.add(withLinkingR(w));

        for (int i = 0; i < words.size(); i++) {
            SentenceWord word = words.get(i);
            SentenceWord next = i + 1 < words.size() ? words.get(i + 1) : null;
            String pron = current.get(i);
            String nextPron = next != null ? current.get(i + 1) : null;
            if (next == null || JsStrings.truthy(word.getPauseAfter()) || !JsStrings.truthy(pron)
                    || !JsStrings.truthy(nextPron)) {
                continue;
            }
            List<String> a = Ipa.phonemes(pron);
            List<String> b = Ipa.phonemes(nextPron);
            String lastPhoneme = last(a, 1);
            String beforeLast = last(a, 2);
            String first = b.isEmpty() ? null : b.getFirst();
            String pair = word.getText() + " " + next.getText();

            if (word.isLinkingR()) {
                processes.add(new ConnectedProcess("linking-r", i, "r de enlace",
                        "la r escrita se pronuncia porque sigue una vocal", pair));
                continue;
            }
            if (PhonemeInventory.isVowel(first) && in(R_VOWELS, lastPhoneme)
                    && !WRITTEN_FINAL_R.matcher(word.getText()).find()) {
                current.set(i, pron + "r");
                processes.add(new ConnectedProcess("intrusive-r", i, "r intrusiva", "/r/ entre /" + lastPhoneme
                        + "/ y vocal, aunque no hay r escrita (frecuente en RP, considerada informal)", pair));
                continue;
            }
            if (("t".equals(lastPhoneme) || "d".equals(lastPhoneme))
                    && beforeLast != null && !PhonemeInventory.isVowel(beforeLast)
                    && !PhonemeInventory.isVowel(first)
                    && !"j".equals(first)
                    && !"h".equals(first)) {
                current.set(i, replaceLast(pron, lastPhoneme, ""));
                processes.add(new ConnectedProcess("elision", i, "elisión",
                        "se pierde /" + lastPhoneme + "/ entre consonantes", pair));
                continue;
            }
            String coalesced = lastPhoneme == null ? null : COALESCENCE.get(lastPhoneme);
            if ("j".equals(first) && coalesced != null) {
                current.set(i, replaceLast(pron, lastPhoneme, ""));
                current.set(i + 1, replaceFirst(nextPron, "j", coalesced));
                processes.add(new ConnectedProcess("coalescence", i, "coalescencia",
                        "/" + lastPhoneme + "/ + /j/ se funden en /" + coalesced + "/", pair));
                continue;
            }
            String target = null;
            if (lastPhoneme != null) {
                if (in(BILABIAL, first)) target = TO_BILABIAL.get(lastPhoneme);
                else if (in(VELAR, first)) target = TO_VELAR.get(lastPhoneme);
            }
            if (target != null) {
                current.set(i, replaceLast(pron, lastPhoneme, target));
                processes.add(new ConnectedProcess("assimilation", i, "asimilación",
                        "/" + lastPhoneme + "/ → /" + target + "/ ante /" + first + "/", pair));
                continue;
            }
            if (("s".equals(lastPhoneme) || "z".equals(lastPhoneme)) && "ʃ".equals(first)) {
                String to = "s".equals(lastPhoneme) ? "ʃ" : "ʒ";
                current.set(i, replaceLast(pron, lastPhoneme, to));
                processes.add(new ConnectedProcess("assimilation", i, "asimilación",
                        "/" + lastPhoneme + "/ → /" + to + "/ ante /ʃ/", pair));
            }
        }

        for (int i = 0; i < words.size(); i++) {
            String original = withLinkingR(words.get(i));
            if (!Objects.equals(current.get(i), original) && current.get(i) != null) {
                words.get(i).setConnectedPron(current.get(i));
            }
        }
        return processes;
    }

    /** {@code Set.of(...).contains(null)} lanza una excepción; un fonema que no existe no pertenece a ningún grupo. */
    private static boolean in(Set<String> group, String phoneme) {
        return phoneme != null && group.contains(phoneme);
    }

    private static String withLinkingR(SentenceWord word) {
        return JsStrings.truthy(word.getPron()) ? word.getPron() + (word.isLinkingR() ? "r" : "") : null;
    }
}
