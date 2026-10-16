package com.dmc00.fonetica;

import static org.assertj.core.api.Assertions.assertThat;

import com.dmc00.fonetica.api.LexiconInfo;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceOptions;
import com.dmc00.fonetica.core.FunctionWords;
import com.dmc00.fonetica.core.JsStrings;
import com.dmc00.fonetica.core.Lexicon;
import com.dmc00.fonetica.core.Sentence;
import com.dmc00.fonetica.core.StudyTools;
import com.dmc00.fonetica.grammar.ParsedToken;
import com.dmc00.fonetica.grammar.QuirkAnalysis;
import com.dmc00.fonetica.tts.EspeakNotation;
import com.dmc00.fonetica.tts.EspeakNotation.StressMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import java.util.TreeSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;

/**
 * Paridad con el motor TypeScript que reemplaza el sidecar (Fase 5, ADR-0002): las respuestas del motor
 * Java tienen que ser iguales, campo por campo, a las que daba la versión TypeScript para el mismo corpus.
 *
 * <p>Los archivos de {@code src/test/resources/paridad/} los generó
 * {@code electron/test/paridad/generar-paridad.ts} con el motor TypeScript, antes de borrarlo (está en la
 * historia de git). Si un cambio de comportamiento es a propósito, se actualiza el archivo a mano en el
 * mismo commit y se explica por qué.
 */
class ParidadTest {

    private static final Lexicon LEXICON = TestFiles.britfone();
    private static final int MAX_REPORTED = 15;

    private static final Sentence.Deps LOCAL_ONLY = new Sentence.Deps() {
        @Override
        public Prons pronsOf(String word) {
            return LEXICON.pronsOf(word);
        }

        @Override
        public FunctionWords.Forms longmanForms(String word) {
            return null;
        }
    };

    private static JsonNode golden(String name) {
        return TestFiles.resourceJson("paridad/" + name);
    }

    private static List<String> strings(JsonNode array) {
        List<String> result = new ArrayList<>();
        array.forEach(item -> result.add(item.asString()));
        return result;
    }

    private static List<Integer> ints(JsonNode array) {
        List<Integer> result = new ArrayList<>();
        array.forEach(item -> result.add(item.asInt()));
        return result;
    }

    @Test
    @DisplayName("léxico: la transcripción Longman de cada palabra de Britfone")
    void lexico() {
        String[] lines = TestFiles.resource("paridad/lexico-britfone.tsv").split("\n");
        assertThat(lines[0]).isEqualTo("# total=" + LEXICON.info().total() + " fromLdoce=" + LEXICON.info().fromLdoce());
        assertThat(LEXICON.info()).isEqualTo(new LexiconInfo(15212, 0));
        List<String> differences = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String[] parts = lines[i].split("\t", -1);
            Prons prons = LEXICON.pronsOf(parts[0]);
            String actual = prons == null ? "null" : prons.source() + "\t" + String.join(" | ", prons.prons());
            String expected = String.join("\t", Arrays.copyOfRange(parts, 1, parts.length));
            if (!actual.equals(expected)) differences.add(parts[0] + ": " + actual + " ≠ " + expected);
        }
        assertThat(lines.length - 1).isGreaterThan(15000);
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("orden de localeCompare: las 15 000 palabras de Britfone y casos con mayúsculas, acentos y signos")
    void ordenLocaleCompare() {
        List<String> expected = List.of(TestFiles.resource("paridad/orden-localecompare.txt").split("\n"));
        List<String> shuffled = new ArrayList<>(expected);
        Collections.shuffle(shuffled, new Random(16));
        shuffled.sort(JsStrings.LOCALE_ORDER);
        List<String> differences = new ArrayList<>();
        for (int i = 0; i < expected.size(); i++) {
            if (!expected.get(i).equals(shuffled.get(i))) differences.add(i + ": " + shuffled.get(i) + " ≠ " + expected.get(i));
        }
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("búsqueda por ortografía")
    void busquedaPorOrtografia() {
        List<String> differences = new ArrayList<>();
        for (JsonNode c : golden("busquedas-ortografia.json")) {
            Object actual = LEXICON.searchSpelling(c.get("query").asString(), c.get("limit").asInt());
            compare("«" + c.get("query").asString() + "»", c.get("result"), actual, differences);
        }
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("búsqueda por fonemas")
    void busquedaPorFonemas() {
        List<String> differences = new ArrayList<>();
        for (JsonNode c : golden("busquedas-fonemas.json")) {
            Object actual = LEXICON.searchPhonemes(strings(c.get("phonemes")), c.get("useStress").asBoolean(),
                    c.get("limit").asInt());
            compare(String.join("", strings(c.get("phonemes"))) + " acento=" + c.get("useStress"), c.get("result"),
                    actual, differences);
        }
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("oraciones: transcripción, procesos del habla conectada y notación eSpeak")
    void oraciones() {
        List<String> differences = new ArrayList<>();
        for (JsonNode c : golden("oraciones.json")) {
            String text = c.get("text").asString();
            JsonNode o = c.get("options");
            SentenceOptions options = new SentenceOptions(o.get("connected").asBoolean(), ints(o.get("forcedStrong")),
                    ints(o.get("forcedWeak")));
            String name = "«" + text + "» " + o;
            SentenceAnalysis analysis = Sentence.analyzeSentence(text, options, LOCAL_ONLY);
            compare(name, c.get("analysis"), analysis, differences);
            compare(name + " eSpeak", c.get("espeak"),
                    EspeakNotation.sentenceToEspeak(text, Sentence.analyzeSentence(text, options, LOCAL_ONLY), false),
                    differences);
            compare(name + " eSpeak con procesos", c.get("espeakWithProcesses"),
                    EspeakNotation.sentenceToEspeak(text, Sentence.analyzeSentence(text, options, LOCAL_ONLY), true),
                    differences);
        }
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("notación eSpeak de palabras sueltas")
    void espeak() {
        List<String> differences = new ArrayList<>();
        for (JsonNode c : golden("espeak.json")) {
            String pron = c.get("pron").asString();
            compare(pron + " keep", c.get("keep"), EspeakNotation.wordToEspeak(pron, StressMode.KEEP), differences);
            compare(pron + " ensure", c.get("ensure"), EspeakNotation.wordToEspeak(pron, StressMode.ENSURE), differences);
            compare(pron + " none", c.get("none"), EspeakNotation.wordToEspeak(pron, StressMode.NONE), differences);
        }
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("herramientas de estudio: terminaciones, corrección del dictado y pronunciaciones")
    void estudio() {
        List<String> differences = new ArrayList<>();
        for (JsonNode c : golden("estudio-inflexiones.json")) {
            compare("inflexiones «" + c.get("verb").asString() + "»", c.get("result"),
                    StudyTools.inflections(c.get("verb").asString(), LEXICON::pronsOf), differences);
        }
        for (JsonNode c : golden("estudio-correcciones.json")) {
            compare("dictado " + c.get("written") + " vs " + c.get("expected").asString(), c.get("result"),
                    StudyTools.checkTranscription(strings(c.get("written")), c.get("expected").asString()), differences);
        }
        for (JsonNode c : golden("estudio-prons.json")) {
            compare("prons «" + c.get("word").asString() + "»", c.get("result"),
                    LEXICON.pronsOf(c.get("word").asString()), differences);
        }
        assertThat(report(differences)).isEmpty();
    }

    @Test
    @DisplayName("gramática: el análisis completo de las 58 oraciones del fixture de spaCy")
    void gramatica() {
        JsonNode parses = TestFiles.resourceJson("spacy-parses.json");
        TypeReference<List<ParsedToken>> tokens = new TypeReference<>() {
        };
        List<String> differences = new ArrayList<>();
        int count = 0;
        for (JsonNode c : golden("gramatica.json")) {
            String sentence = c.get("sentence").asString();
            List<ParsedToken> parsed = TestFiles.JSON.convertValue(parses.get(sentence), tokens);
            compare("«" + sentence + "»", c.get("result"), QuirkAnalysis.analyzeGrammar(parsed), differences);
            count++;
        }
        assertThat(count).isEqualTo(58);
        assertThat(report(differences)).isEmpty();
    }

    // --- Comparación de JSON ---------------------------------------------------------------------------

    /** Compara el JSON esperado con el que produce Java para {@code actual}, anotando cada diferencia. */
    private static void compare(String name, JsonNode expected, Object actual, List<String> differences) {
        JsonNode actualJson = TestFiles.JSON.valueToTree(actual);
        int before = differences.size();
        diff(name + " ", expected, actualJson, differences);
        if (differences.size() > before + 3) {
            differences.subList(before + 3, differences.size()).clear();
            differences.add(name + " … (más diferencias en el mismo caso)");
        }
    }

    /** Igualdad estricta: los mismos campos (sin agregar ni sacar opcionales) y los mismos valores. */
    private static void diff(String path, JsonNode expected, JsonNode actual, List<String> out) {
        if (expected.isNumber() && actual.isNumber()) {
            // JavaScript escribe 1 y Java 1.0: se comparan como números.
            if (expected.asDouble() != actual.asDouble()) out.add(path + "= " + actual + " ≠ " + expected);
            return;
        }
        if (expected.getNodeType() != actual.getNodeType()) {
            out.add(path + "= " + actual + " ≠ " + expected);
            return;
        }
        if (expected.isObject()) {
            TreeSet<String> names = new TreeSet<>();
            expected.propertyNames().forEach(names::add);
            actual.propertyNames().forEach(names::add);
            for (String field : names) {
                if (!expected.has(field)) out.add(path + "." + field + " sobra (" + actual.get(field) + ")");
                else if (!actual.has(field)) out.add(path + "." + field + " falta (" + expected.get(field) + ")");
                else diff(path + "." + field, expected.get(field), actual.get(field), out);
            }
        } else if (expected.isArray()) {
            if (expected.size() != actual.size()) {
                out.add(path + " tiene " + actual.size() + " elementos ≠ " + expected.size() + ": " + abbreviate(actual)
                        + " ≠ " + abbreviate(expected));
                return;
            }
            Iterator<JsonNode> e = expected.iterator();
            Iterator<JsonNode> a = actual.iterator();
            for (int i = 0; e.hasNext(); i++) diff(path + "[" + i + "]", e.next(), a.next(), out);
        } else if (!expected.equals(actual)) {
            out.add(path + "= " + actual + " ≠ " + expected);
        }
    }

    private static String abbreviate(JsonNode node) {
        String text = node.toString();
        return text.length() > 300 ? text.substring(0, 300) + "…" : text;
    }

    private static List<String> report(List<String> differences) {
        if (differences.size() <= MAX_REPORTED) return differences;
        List<String> shown = new ArrayList<>(differences.subList(0, MAX_REPORTED));
        shown.add("… y " + (differences.size() - MAX_REPORTED) + " diferencias más");
        return shown;
    }
}
