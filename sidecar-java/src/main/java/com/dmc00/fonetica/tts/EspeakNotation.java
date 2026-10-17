package com.dmc00.fonetica.tts;

import static com.dmc00.fonetica.core.PhonemeInventory.PRIMARY_STRESS;
import static com.dmc00.fonetica.core.PhonemeInventory.SECONDARY_STRESS;

import com.dmc00.fonetica.api.FunctionWordInfo;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceWord;
import com.dmc00.fonetica.core.Ipa;
import com.dmc00.fonetica.core.JsStrings;
import com.dmc00.fonetica.core.PhonemeInventory;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Notación Longman → notación de eSpeak, que es la que "entiende" la voz de Piper (se entrenó con
 * transcripciones de eSpeak, variante "en" = inglés británico). Calibrado contra eSpeak en octubre de
 * 2026 con las palabras de la tabla fonémica (ver {@code EspeakNotationTest}):
 * <pre>
 *   Longman  æ   e   ɪə   r   u          (cat, bed, here, red, situation)
 *   eSpeak   a   ɛ   iə   ɹ   uː
 * </pre>
 * eSpeak pone la marca de acento justo antes de la vocal (kəmpjˈuːtə), no al comienzo de la sílaba como
 * Longman (kəmˈpjuːtə), y también la pone en los monosílabos (kˈat).
 */
public final class EspeakNotation {

    /**
     * Qué hacer con el acento.
     * <ul>
     *   <li>KEEP: respeta las marcas que tenga la transcripción.</li>
     *   <li>ENSURE: si no tiene acento principal, lo pone en la primera vocal (palabras de contenido,
     *       function words en forma fuerte).</li>
     *   <li>NONE: sin acento (function words en forma débil).</li>
     * </ul>
     */
    public enum StressMode { KEEP, ENSURE, NONE }

    private static final Map<String, String> TO_ESPEAK = Map.of("æ", "a", "e", "ɛ", "ɪə", "iə", "r", "ɹ", "u", "uː");
    private static final Pattern PARENTHESES = Pattern.compile("[()]");
    private static final Pattern PUNCTUATION = Pattern.compile("[.?!,;:]");

    private EspeakNotation() {
    }

    /** Convierte la transcripción de una palabra. Los sonidos opcionales "(ə)" se pronuncian. */
    public static String wordToEspeak(String pron, StressMode stress) {
        List<String> tokens = Ipa.tokenize(PARENTHESES.matcher(pron).replaceAll("")).tokens();
        boolean hasPrimary = tokens.contains(PRIMARY_STRESS);
        StringBuilder out = new StringBuilder();
        String pending = null;
        boolean stressed = false;
        for (String token : tokens) {
            if (token.equals(PRIMARY_STRESS) || token.equals(SECONDARY_STRESS)) {
                if (stress == StressMode.KEEP || stress == StressMode.ENSURE) pending = token;
                continue;
            }
            String symbol = TO_ESPEAK.getOrDefault(token, token);
            if (PhonemeInventory.isVowel(token)) {
                String mark = pending != null ? pending : "";
                if (stress == StressMode.ENSURE && !hasPrimary && !stressed) mark = PRIMARY_STRESS;
                if (mark.equals(PRIMARY_STRESS)) stressed = true;
                out.append(mark).append(symbol);
                pending = null;
            } else {
                out.append(symbol);
            }
        }
        return out.toString();
    }

    /**
     * La oración tal como se muestra (formas débiles y fuertes elegidas, r de enlace y, si se pide, los
     * procesos del habla conectada) en notación eSpeak, con la puntuación original para que la voz haga las
     * pausas y la entonación. Las function words débiles van sin acento y las fuertes con acento, así el
     * énfasis se oye.
     */
    public static String sentenceToEspeak(String text, SentenceAnalysis analysis, boolean withProcesses) {
        List<String> parts = new ArrayList<>();
        List<SentenceWord> words = analysis.words();
        for (int i = 0; i < words.size(); i++) {
            SentenceWord word = words.get(i);
            if (!JsStrings.truthy(word.getPron())) continue;
            FunctionWordInfo fw = word.getFunctionWord();
            StressMode stress = fw != null && fw.getForm().equals("weak") ? StressMode.NONE : StressMode.ENSURE;
            String pron = withProcesses && JsStrings.truthy(word.getConnectedPron())
                    ? word.getConnectedPron()
                    : word.getPron() + (word.isLinkingR() ? "r" : "");
            StringBuilder part = new StringBuilder(wordToEspeak(pron, stress));
            SentenceWord next = i + 1 < words.size() ? words.get(i + 1) : null;
            String gap = text.substring(word.getEnd(), next != null ? next.getStart() : text.length());
            Matcher punctuation = PUNCTUATION.matcher(gap);
            String mark = punctuation.find() ? punctuation.group() : null;
            if ("?".equals(mark)) part.append('?');
            else if ("!".equals(mark) || ".".equals(mark)) part.append('.');
            else if (mark != null) part.append(',');
            else if (next == null) part.append('.');
            parts.add(part.toString());
        }
        return String.join(" ", parts);
    }
}
