package com.dmc00.fonetica.core;

import com.dmc00.fonetica.api.InflectedForm;
import com.dmc00.fonetica.api.InflectionInfo;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.TranscriptionCheck;
import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * Herramientas de estudio que comparten la sección de fonética y la de gramática: corrección del dictado
 * y pronunciación de las terminaciones -s / -ed.
 */
public final class StudyTools {

    private static final Pattern TAKES_ES = Pattern.compile("(s|x|z|ch|sh|o)\\z");
    private static final Pattern CONSONANT_Y = Pattern.compile("[^aeiou]y\\z");

    private StudyTools() {
    }

    /**
     * Compara lo que escribió el alumno con la transcripción correcta. Se prueba cada variante
     * (alternativas de Longman, sonidos opcionales) y se queda con la más cercana. No cuenta el acento.
     */
    public static TranscriptionCheck checkTranscription(List<String> written, String expected) {
        List<String> input = Ipa.toVariant(written).segments();
        double bestDistance = Double.POSITIVE_INFINITY;
        List<String> bestSegments = List.of();
        for (PronVariant variant : Transcription.parseLongmanPron(expected)) {
            double distance = Distance.phonemeDistance(input, variant.segments());
            if (distance < bestDistance) {
                bestDistance = distance;
                bestSegments = variant.segments();
            }
        }
        Distance.Alignment alignment = Distance.phonemeAlignment(input, bestSegments);
        List<String> alternatives = Transcription.expandLongmanAlternatives(expected);
        return new TranscriptionCheck(
                bestDistance == 0,
                Math.round(alignment.distance() * 100) / 100.0,
                alignment.steps(),
                alternatives.isEmpty() ? expected : alternatives.getFirst());
    }

    /** -s (plural, 3.ª persona) y -ed (pasado regular) de un verbo: del diccionario o con la regla. */
    public static InflectionInfo inflections(String verb, Function<String, Prons> pronsOf) {
        String base = JsStrings.lower(JsStrings.trim(verb));
        String basePron = firstPron(pronsOf, base);
        if (basePron == null) return new InflectionInfo(base, null, null, null);

        String sSpelling = TAKES_ES.matcher(base).find()
                ? base + "es"
                : CONSONANT_Y.matcher(base).find() ? base.substring(0, base.length() - 1) + "ies" : base + "s";
        String edSpelling = base.endsWith("e")
                ? base + "d"
                : CONSONANT_Y.matcher(base).find() ? base.substring(0, base.length() - 1) + "ied" : base + "ed";

        return new InflectionInfo(
                base,
                basePron,
                form(sSpelling, basePron, Sentence.sEnding(basePron, base), pronsOf),
                form(edSpelling, basePron, Sentence.edEnding(basePron, base), pronsOf));
    }

    private static InflectedForm form(String spelling, String basePron, Sentence.Ending rule,
                                      Function<String, Prons> pronsOf) {
        String known = firstPron(pronsOf, spelling);
        return new InflectedForm(
                spelling,
                known != null ? known : basePron + rule.ending(),
                "/" + rule.ending() + "/",
                rule.rule(),
                JsStrings.truthy(known));
    }

    private static String firstPron(Function<String, Prons> pronsOf, String word) {
        Prons prons = pronsOf.apply(word);
        if (prons == null || prons.prons().isEmpty()) return null;
        List<String> alternatives = Transcription.expandLongmanAlternatives(prons.prons().getFirst());
        return alternatives.isEmpty() ? null : alternatives.getFirst();
    }
}
