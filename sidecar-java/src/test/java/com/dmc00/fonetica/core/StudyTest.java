package com.dmc00.fonetica.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.api.ConnectedProcess;
import com.dmc00.fonetica.api.FunctionWordInfo;
import com.dmc00.fonetica.api.InflectedForm;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceOptions;
import com.dmc00.fonetica.api.TranscriptionCheck;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Portado de {@code electron/test/study.test.ts}: material de estudio, dictado, terminaciones y habla
 * conectada. Los dos casos de ese archivo que prueban código de la interfaz ({@code verbPattern} y la
 * coherencia de los ejercicios) pasaron al spec de Angular ({@code src/app/shared/study-data.spec.ts}).
 */
class StudyTest {

    private static final Lexicon LEXICON = TestFiles.britfone();
    private static final SentenceOptions CONNECTED = new SentenceOptions(true, List.of(), List.of());
    private static final JsonNode STUDY_DATA = TestFiles.resourceJson("study-data.json");

    static final Sentence.Deps LOCAL_ONLY = new Sentence.Deps() {
        @Override
        public Prons pronsOf(String word) {
            return LEXICON.pronsOf(word);
        }

        @Override
        public FunctionWords.Forms longmanForms(String word) {
            return null;
        }
    };

    private static SentenceAnalysis analyze(String text) {
        return Sentence.analyzeSentence(text, CONNECTED, LOCAL_ONLY);
    }

    private static List<String> tokens(String ipa) {
        return Ipa.tokenize(ipa).tokens();
    }

    @Nested
    @DisplayName("material de estudio")
    class Material {

        @Test
        @DisplayName("cada palabra del dictado y de los pares mínimos tiene transcripción")
        void dictadoYPares() {
            List<String> words = new ArrayList<>();
            for (JsonNode level : STUDY_DATA.get("dictationLevels")) {
                if (!level.get("phrases").asBoolean()) level.get("items").forEach(w -> words.add(w.asString()));
            }
            for (JsonNode set : STUDY_DATA.get("minimalPairs")) {
                set.get("pairs").forEach(pair -> pair.forEach(w -> words.add(w.asString())));
            }
            assertThat(words).hasSizeGreaterThan(50);
            assertThat(words.stream().filter(w -> LEXICON.pronsOf(w) == null)).isEmpty();
        }

        @Test
        @DisplayName("cada forma de los verbos irregulares tiene transcripción (del diccionario o fija)")
        void verbosIrregulares() {
            List<String> missing = new ArrayList<>();
            for (JsonNode verb : STUDY_DATA.get("irregularVerbs")) {
                for (String key : List.of("base", "past", "participle")) {
                    if (verb.get("prons").hasNonNull(key)) continue;
                    for (String form : verb.get(key).asString().split(" / ")) {
                        if (LEXICON.pronsOf(form) == null) missing.add(form);
                    }
                }
            }
            assertThat(missing).isEmpty();
        }
    }

    @Nested
    @DisplayName("dictado")
    class Dictado {

        @Test
        @DisplayName("acepta la transcripción correcta (sin contar el acento) y marca los errores")
        void correctaYErrores() {
            assertThat(StudyTools.checkTranscription(tokens("ˈwɔːtə"), "ˈwɔːtə").exact()).isTrue();
            TranscriptionCheck wrong = StudyTools.checkTranscription(tokens("wɔːtər"), "ˈwɔːtə");
            assertThat(wrong.exact()).isFalse();
            assertThat(wrong.alignment().getLast().op()).isEqualTo("extra");
        }

        @Test
        @DisplayName("considera las variantes de Longman (sonidos opcionales y alternativas)")
        void variantesDeLongman() {
            assertThat(StudyTools.checkTranscription(tokens("ɡʌvmənt"), "ˈɡʌv(ə)mənt").exact()).isTrue();
            assertThat(StudyTools.checkTranscription(tokens("skedjuːl"), "ˈʃedjuːl, ˈske-").exact()).isTrue();
        }
    }

    @Nested
    @DisplayName("terminaciones -s y -ed")
    class Terminaciones {

        private InflectedForm ed(String verb) {
            return StudyTools.inflections(verb, LEXICON::pronsOf).ed();
        }

        private InflectedForm s(String verb) {
            return StudyTools.inflections(verb, LEXICON::pronsOf).s();
        }

        @Test
        @DisplayName("aplica las tres reglas de -ed")
        void reglasDeEd() {
            assertThat(ed("stop").ending()).isEqualTo("/t/");
            assertThat(ed("play").ending()).isEqualTo("/d/");
            assertThat(ed("want").ending()).isEqualTo("/ɪd/");
        }

        @Test
        @DisplayName("aplica las tres reglas de -s y arma la ortografía")
        void reglasDeS() {
            InflectedForm watch = s("watch");
            assertThat(watch.spelling()).isEqualTo("watches");
            assertThat(watch.ending()).isEqualTo("/ɪz/");
            assertThat(s("laugh").ending()).isEqualTo("/s/");
            assertThat(s("study").spelling()).isEqualTo("studies");
            assertThat(s("love").ending()).isEqualTo("/z/");
        }
    }

    @Nested
    @DisplayName("procesos del habla conectada")
    class HablaConectada {

        private List<String> processes(String text) {
            return analyze(text).processes().stream()
                    .map(p -> p.kind() + ": " + p.words() + " (" + p.detail() + ")")
                    .toList();
        }

        @Test
        @DisplayName("asimilación de lugar")
        void asimilacion() {
            assertThat(processes("Ten boys came.")).anyMatch(p -> p.startsWith("assimilation: Ten boys (/n/ → /m/"));
            assertThat(processes("Look at that cat.")).anyMatch(p -> p.startsWith("assimilation: that cat (/t/ → /k/"));
            assertThat(processes("This shop is open.")).anyMatch(p -> p.startsWith("assimilation: This shop (/s/ → /ʃ/"));
        }

        @Test
        @DisplayName("elisión de /t/ entre consonantes")
        void elision() {
            assertThat(processes("See you next day.")).anyMatch(p -> p.startsWith("elision: next day"));
        }

        @Test
        @DisplayName("coalescencia con /j/")
        void coalescencia() {
            SentenceAnalysis result = analyze("Don't you know?");
            assertThat(result.processes()).extracting(ConnectedProcess::kind).contains("coalescence");
            assertThat(result.connectedTranscription()).contains("tʃu");
        }

        @Test
        @DisplayName("r intrusiva y r de enlace")
        void rIntrusivaYDeEnlace() {
            assertThat(processes("The idea of it.")).anyMatch(p -> p.startsWith("intrusive-r: idea of"));
            assertThat(processes("It is far away.")).anyMatch(p -> p.startsWith("linking-r: far away"));
        }

        @Test
        @DisplayName("no aplica procesos sin habla conectada")
        void sinHablaConectada() {
            SentenceAnalysis result = Sentence.analyzeSentence("Ten boys came.",
                    new SentenceOptions(false, List.of(), List.of()), LOCAL_ONLY);
            assertThat(result.processes()).isEmpty();
        }
    }

    @Test
    @DisplayName("una palabra como \"constructor\" no rompe la oración (en TypeScript chocaba con Object.prototype)")
    void constructorNoRompe() {
        SentenceAnalysis result = analyze("The constructor works.");
        assertThat(result.words().get(1).getKey()).isEqualTo("constructor");
        assertThat(result.words().get(1).getFunctionWord()).as("no es una function word").isNull();
        FunctionWordInfo the = result.words().getFirst().getFunctionWord();
        assertThat(the.getForm()).isEqualTo("weak");
    }
}
