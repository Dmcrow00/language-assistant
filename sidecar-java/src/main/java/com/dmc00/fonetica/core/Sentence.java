package com.dmc00.fonetica.core;

import com.dmc00.fonetica.api.ConnectedProcess;
import com.dmc00.fonetica.api.FunctionWordInfo;
import com.dmc00.fonetica.api.LdoceEntry;
import com.dmc00.fonetica.api.LdoceLookup;
import com.dmc00.fonetica.api.LdocePronForm;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceOptions;
import com.dmc00.fonetica.api.SentenceWord;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Transcripción de oraciones completas.
 *
 * <ol>
 *   <li>Se separan las palabras y se anotan las pausas (coma → |, fin de oración → ||).</li>
 *   <li>Cada palabra toma su transcripción del diccionario local (Longman si ya se consultó, si no
 *       Britfone). Si no está, se intenta armarla desde otra (cats ← cat + -s).</li>
 *   <li>Las function words se transcriben en forma fuerte o débil según el contexto (ver
 *       {@link FunctionWords}), con las formas de Longman cuando están en caché.</li>
 *   <li>Con la palabra siguiente ya resuelta se elige la forma ante vocal (the → ði) y se agrega la r de
 *       enlace (far‿away → /fɑːr əˈweɪ/).</li>
 * </ol>
 */
public final class Sentence {

    /** Lo que la transcripción necesita saber de cada palabra. */
    public interface Deps {
        /** Pronunciaciones de una palabra en el diccionario local; null si no está. */
        Prons pronsOf(String word);

        /** Formas débil/fuerte según Longman, si la palabra ya se consultó; null si no. */
        FunctionWords.Forms longmanForms(String word);
    }

    /** Una palabra de la oración antes de transcribirla. */
    static final class WordToken {
        final String text;
        final String key;
        final int start;
        final int end;
        String pauseAfter;
        final boolean sentenceInitial;
        boolean question;

        WordToken(String text, String key, int start, int end, boolean sentenceInitial) {
            this.text = text;
            this.key = key;
            this.start = start;
            this.end = end;
            this.sentenceInitial = sentenceInitial;
        }
    }

    private record Derivation(String pron, String note) {
    }

    /** Una terminación pronunciada (-s, -ed) y la regla que la explica. */
    public record Ending(String ending, String rule) {
    }

    private static final Pattern WORD_PATTERN = Pattern.compile("[A-Za-z]+(?:[-'’][A-Za-z]+)*");
    private static final Pattern SENTENCE_END = Pattern.compile("[.!?]");
    private static final Pattern MINOR_PAUSE = Pattern.compile("[,;:()—–\"]");
    /** Vocales tras las cuales una r escrita final se pronuncia si sigue otra vocal (r de enlace). */
    private static final List<String> LINKING_R_VOWELS = List.of("ə", "ɑː", "ɔː", "ɜː", "ɪə", "eə", "ʊə");
    private static final Pattern STRONG_LABEL = Pattern.compile("strong", Pattern.CASE_INSENSITIVE);
    private static final Pattern BEFORE_VOWEL_LABEL = Pattern.compile("before vowel", Pattern.CASE_INSENSITIVE);
    private static final Pattern SILENT_H = Pattern.compile("^(hour|honest|honou?r|heir)");
    private static final Pattern YOD_VOWEL = Pattern.compile("^(uni|use|usu|euro|one|once)");
    private static final Pattern VOWEL_LETTER = Pattern.compile("^[aeiou]");
    private static final Pattern CONTRACTION = Pattern.compile("^(.+)'(s|ll|ve|d|re)\\z");
    private static final Pattern SIBILANT_ES = Pattern.compile("(s|x|z|ch|sh)es\\z");

    private static final Set<String> SIBILANTS = Set.of("s", "z", "ʃ", "ʒ", "tʃ", "dʒ");
    private static final Set<String> VOICELESS = Set.of("p", "t", "k", "f", "θ", "s", "ʃ", "tʃ");

    private Sentence() {
    }

    static List<WordToken> tokenizeSentence(String text) {
        List<WordToken> tokens = new ArrayList<>();
        Matcher match = WORD_PATTERN.matcher(text);
        while (match.find()) {
            int start = match.start();
            WordToken previous = tokens.isEmpty() ? null : tokens.getLast();
            if (previous != null) previous.pauseAfter = pauseBetween(text.substring(previous.end, start));
            tokens.add(new WordToken(
                    match.group(),
                    JsStrings.lower(match.group()).replace("’", "'"),
                    start,
                    start + match.group().length(),
                    previous == null || "||".equals(previous.pauseAfter)));
        }
        if (!tokens.isEmpty()) tokens.getLast().pauseAfter = "||";
        // Una oración es pregunta si el próximo signo de cierre después de la palabra es "?".
        for (WordToken token : tokens) {
            Matcher closing = SENTENCE_END.matcher(text.substring(token.end));
            token.question = closing.find() && closing.group().equals("?");
        }
        return tokens;
    }

    private static String pauseBetween(String gap) {
        if (SENTENCE_END.matcher(gap).find()) return "||";
        if (MINOR_PAUSE.matcher(gap).find()) return "|";
        return null;
    }

    public static SentenceAnalysis analyzeSentence(String text, SentenceOptions options, Deps deps) {
        List<WordToken> tokens = tokenizeSentence(text);
        Set<Integer> forcedStrong = new HashSet<>(options.forcedStrong());
        Set<Integer> forcedWeak = new HashSet<>(options.forcedWeak());

        // Paso 1: transcripción de cada palabra sin mirar todavía cómo empieza la siguiente.
        List<SentenceWord> words = new ArrayList<>();
        for (int index = 0; index < tokens.size(); index++) {
            WordToken token = tokens.get(index);
            SentenceWord word = new SentenceWord(index, token.text, token.start, token.end, token.key, token.pauseAfter);
            words.add(word);

            FunctionWords.Forms longman = deps.longmanForms(token.key);
            FunctionWords.Forms forms = longman != null ? longman : FunctionWords.FUNCTION_WORDS.get(token.key);
            if (forms != null) {
                String override = forcedStrong.contains(index) ? "strong" : forcedWeak.contains(index) ? "weak" : null;
                FunctionWords.Decision decision = FunctionWords.decideForm(new FunctionWords.Context(
                        token.key,
                        index + 1 < tokens.size() ? tokens.get(index + 1).key : null,
                        token.sentenceInitial,
                        JsStrings.truthy(token.pauseAfter),
                        token.question,
                        override,
                        options.connected()));
                String pron = decision.form().equals("strong")
                        ? forms.strong()
                        : FunctionWords.pickWeakForm(forms.weak(), null, token.sentenceInitial, false);
                word.setPron(pron);
                word.setSource(longman != null ? "ldoce" : "rule");
                word.setFunctionWord(new FunctionWordInfo(
                        forms.category(),
                        decision.form(),
                        forms.weak(),
                        JsStrings.truthy(forms.weakBeforeVowel()) ? forms.weakBeforeVowel() : null,
                        forms.strong(),
                        decision.reason(),
                        options.connected() && (forcedStrong.contains(index) || forcedWeak.contains(index)),
                        JsStrings.truthy(decision.ambiguous()) ? decision.ambiguous() : null,
                        longman != null));
                word.setAlternatives(alternativesOf(forms.weak(), forms.weakBeforeVowel(), forms.strong(), pron));
                continue;
            }

            Prons known = deps.pronsOf(token.key);
            if (known != null && !known.prons().isEmpty()) {
                List<String> all = new ArrayList<>();
                for (String p : known.prons()) all.addAll(Transcription.expandLongmanAlternatives(p));
                word.setPron(all.isEmpty() ? null : all.getFirst());
                word.setSource(known.source());
                word.setAlternatives(unique(all.size() > 1 ? all.subList(1, all.size()) : List.of()));
                continue;
            }

            Derivation derived = deriveFromBase(token.key, deps);
            if (derived != null) {
                word.setPron(derived.pron());
                word.setSource("derived");
                word.setNote(derived.note());
            }
        }

        // Paso 2: forma ante vocal y r de enlace, que dependen de la palabra siguiente.
        for (int i = 0; i < words.size(); i++) {
            SentenceWord word = words.get(i);
            SentenceWord next = JsStrings.truthy(word.getPauseAfter()) || i + 1 >= words.size() ? null : words.get(i + 1);
            boolean nextStartsWithVowel = next != null && startsWithVowel(next);
            FunctionWordInfo fw = word.getFunctionWord();
            if (fw != null && fw.getForm().equals("weak")) {
                boolean sentenceInitial = tokens.get(i).sentenceInitial;
                word.setPron(FunctionWords.pickWeakForm(fw.getWeak(), fw.getWeakBeforeVowel(), sentenceInitial,
                        nextStartsWithVowel));
                if (nextStartsWithVowel && JsStrings.truthy(fw.getWeakBeforeVowel())) {
                    fw.appendToReason(" Ante vocal: /" + fw.getWeakBeforeVowel() + "/.");
                }
                word.setAlternatives(alternativesOf(fw.getWeak(), fw.getWeakBeforeVowel(), fw.getStrong(), word.getPron()));
            }
            if (options.connected() && next != null && nextStartsWithVowel && JsStrings.truthy(word.getPron())
                    && takesLinkingR(word.getText(), word.getPron())) {
                word.setLinkingR(true);
            }
        }

        // Paso 3: procesos del habla conectada (asimilación, elisión...), que se muestran aparte.
        List<ConnectedProcess> processes = options.connected() ? ConnectedSpeech.detectProcesses(words) : List.of();
        return new SentenceAnalysis(words, transcriptionLine(words, false), processes, transcriptionLine(words, true));
    }

    /** Formas débil/fuerte de Longman a partir de una consulta en caché (sólo si Longman indica "strong"). */
    public static FunctionWords.Forms longmanFormsFromLookup(LdoceLookup lookup) {
        if (lookup == null || !lookup.status().equals("found")) return null;
        for (LdoceEntry entry : lookup.entries()) {
            List<LdocePronForm> forms = entry.pronFormsBrE();
            if (forms == null) continue;
            LdocePronForm strong = forms.stream().filter(f -> matches(STRONG_LABEL, f.label())).findFirst().orElse(null);
            if (strong == null) continue;
            List<String> weak = new ArrayList<>();
            for (LdocePronForm f : forms) {
                if (!JsStrings.truthy(f.label())) weak.addAll(Transcription.expandLongmanAlternatives(f.pron()));
            }
            LdocePronForm beforeVowel = forms.stream()
                    .filter(f -> matches(BEFORE_VOWEL_LABEL, f.label()))
                    .findFirst()
                    .orElse(null);
            FunctionWords.Forms table = FunctionWords.FUNCTION_WORDS.get(lookup.query());
            String category = table != null ? table.category()
                    : entry.pos() != null ? entry.pos() : "function word";
            return new FunctionWords.Forms(
                    category,
                    weak.isEmpty() ? List.of(strong.pron()) : weak,
                    beforeVowel != null ? firstOrNull(Transcription.expandLongmanAlternatives(beforeVowel.pron())) : null,
                    firstOrNull(Transcription.expandLongmanAlternatives(strong.pron())));
        }
        return null;
    }

    private static boolean matches(Pattern pattern, String label) {
        return pattern.matcher(label == null ? "" : label).find();
    }

    private static String firstOrNull(List<String> list) {
        return list.isEmpty() ? null : list.getFirst();
    }

    /** /aɪ ˈwɒnt tə ɡəʊ | ənd .../ — las pausas del final no se escriben. */
    private static String transcriptionLine(List<SentenceWord> words, boolean withProcesses) {
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < words.size(); i++) {
            SentenceWord w = words.get(i);
            String part = withProcesses && JsStrings.truthy(w.getConnectedPron())
                    ? w.getConnectedPron()
                    : (w.getPron() != null ? w.getPron() : "?") + (w.isLinkingR() ? "r" : "");
            if (JsStrings.truthy(w.getPauseAfter()) && i < words.size() - 1) part += " " + w.getPauseAfter();
            parts.add(part);
        }
        return parts.isEmpty() ? "" : "/" + String.join(" ", parts) + "/";
    }

    private static List<String> alternativesOf(List<String> weak, String weakBeforeVowel, String strong, String chosen) {
        List<String> all = new ArrayList<>(weak);
        if (JsStrings.truthy(weakBeforeVowel)) all.add(weakBeforeVowel);
        all.add(strong);
        return unique(all).stream().filter(f -> !Objects.equals(f, chosen)).toList();
    }

    private static List<String> unique(List<String> list) {
        return new ArrayList<>(new LinkedHashSet<>(list));
    }

    private static boolean startsWithVowel(SentenceWord word) {
        if (JsStrings.truthy(word.getPron())) {
            List<String> phonemes = Ipa.phonemes(word.getPron());
            return !phonemes.isEmpty() && PhonemeInventory.isVowel(phonemes.getFirst());
        }
        // Sin transcripción: se adivina por la ortografía (hour /aʊə/, university /juː/).
        String k = word.getKey();
        if (SILENT_H.matcher(k).find()) return true;
        if (YOD_VOWEL.matcher(k).find()) return false;
        return VOWEL_LETTER.matcher(k).find();
    }

    static boolean takesLinkingR(String spelling, String pron) {
        if (!ConnectedSpeech.WRITTEN_FINAL_R.matcher(spelling).find()) return false;
        List<String> phonemes = Ipa.phonemes(pron);
        return !phonemes.isEmpty() && LINKING_R_VOWELS.contains(phonemes.getLast());
    }

    // --- Palabras que no están en el diccionario: se arman desde la base ------------------------

    /** Plurales, tercera persona, pasados, gerundios, posesivos y compuestos con guion. */
    private static Derivation deriveFromBase(String key, Deps deps) {
        if (key.contains("-")) {
            List<String> parts = new ArrayList<>();
            for (String part : key.split("-", -1)) parts.add(firstPron(deps, part));
            if (parts.stream().allMatch(JsStrings::truthy)) {
                return new Derivation(String.join("", parts), "Armada uniendo las partes del compuesto.");
            }
        }

        Matcher contraction = CONTRACTION.matcher(key);
        if (contraction.find()) {
            String base = contraction.group(1);
            String ending = contraction.group(2);
            Map<String, String> fixedEndings = Map.of("ll", "l", "ve", "v", "d", "d", "re", "ə");
            return attempt(deps, List.of(base),
                    (p, b) -> ending.equals("s") ? sSuffix(p, "") : fixedEndings.get(ending), "'" + ending);
        }

        if (key.endsWith("ies")) {
            return attempt(deps, List.of(key.substring(0, key.length() - 3) + "y"), (p, b) -> "z", "-s");
        }
        if (SIBILANT_ES.matcher(key).find()) {
            return attempt(deps, List.of(key.substring(0, key.length() - 2)), (p, b) -> linking(p, b) + "ɪz", "-es");
        }
        if (key.endsWith("s") && !key.endsWith("ss")) {
            return attempt(deps, List.of(key.substring(0, key.length() - 1)), Sentence::sSuffix, "-s");
        }
        if (key.endsWith("ied")) {
            return attempt(deps, List.of(key.substring(0, key.length() - 3) + "y"), (p, b) -> "d", "-ed");
        }
        if (key.endsWith("ed")) {
            String stem = key.substring(0, key.length() - 2);
            return attempt(deps, List.of(stem, key.substring(0, key.length() - 1), undouble(stem)),
                    Sentence::edSuffix, "-ed");
        }
        if (key.endsWith("ing")) {
            String stem = key.substring(0, key.length() - 3);
            return attempt(deps, List.of(stem, stem + "e", undouble(stem)), (p, b) -> linking(p, b) + "ɪŋ", "-ing");
        }
        return null;
    }

    /** Prueba las bases en orden y arma la palabra con la primera que esté en el diccionario. */
    private static Derivation attempt(Deps deps, List<String> bases, BiFunction<String, String, String> suffix,
                                      String label) {
        for (String base : bases) {
            String basePron = base.length() > 1 ? firstPron(deps, base) : null;
            if (JsStrings.truthy(basePron)) {
                return new Derivation(basePron + suffix.apply(basePron, base),
                        "Armada a partir de «" + base + "» + " + label + ".");
            }
        }
        return null;
    }

    /** La primera transcripción completa de una palabra del diccionario; null si no está. */
    private static String firstPron(Deps deps, String word) {
        Prons known = deps.pronsOf(word);
        if (known == null || known.prons().isEmpty()) return null;
        return firstOrNull(Transcription.expandLongmanAlternatives(known.prons().getFirst()));
    }

    private static String lastPhoneme(String pron) {
        List<String> phonemes = Ipa.phonemes(pron);
        return phonemes.isEmpty() ? null : phonemes.getLast();
    }

    /** La r escrita de la base se pronuncia si el sufijo empieza con vocal (water → watering /ˈwɔːtərɪŋ/). */
    private static String linking(String basePron, String base) {
        return takesLinkingR(base, basePron) ? "r" : "";
    }

    /** Terminación -s y la regla que la explica. */
    public static Ending sEnding(String basePron, String base) {
        String last = orEmpty(lastPhoneme(basePron));
        if (SIBILANTS.contains(last)) {
            return new Ending(linking(basePron, base) + "ɪz", "/ɪz/ porque la base termina en una sibilante (/" + last + "/).");
        }
        return VOICELESS.contains(last)
                ? new Ending("s", "/s/ porque la base termina en una consonante sorda (/" + last + "/).")
                : new Ending("z", "/z/ porque la base termina en un sonido sonoro (/" + last + "/).");
    }

    /** Terminación -ed y la regla que la explica. */
    public static Ending edEnding(String basePron, String base) {
        String last = orEmpty(lastPhoneme(basePron));
        if (last.equals("t") || last.equals("d")) {
            return new Ending(linking(basePron, base) + "ɪd", "/ɪd/ porque la base termina en /" + last + "/.");
        }
        return VOICELESS.contains(last)
                ? new Ending("t", "/t/ porque la base termina en una consonante sorda (/" + last + "/).")
                : new Ending("d", "/d/ porque la base termina en un sonido sonoro (/" + last + "/).");
    }

    private static String sSuffix(String basePron, String base) {
        String last = orEmpty(lastPhoneme(basePron));
        if (SIBILANTS.contains(last)) return linking(basePron, base) + "ɪz";
        return VOICELESS.contains(last) ? "s" : "z";
    }

    private static String edSuffix(String basePron, String base) {
        String last = orEmpty(lastPhoneme(basePron));
        if (last.equals("t") || last.equals("d")) return linking(basePron, base) + "ɪd";
        return VOICELESS.contains(last) ? "t" : "d";
    }

    private static String orEmpty(String text) {
        return text == null ? "" : text;
    }

    /** stopp → stop, runn → run (consonante duplicada antes del sufijo). */
    private static String undouble(String stem) {
        return stem.length() > 2 && stem.charAt(stem.length() - 1) == stem.charAt(stem.length() - 2)
                ? stem.substring(0, stem.length() - 1)
                : stem;
    }
}
