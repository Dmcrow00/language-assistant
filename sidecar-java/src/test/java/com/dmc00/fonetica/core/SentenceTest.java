package com.dmc00.fonetica.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.api.LdoceLookup;
import com.dmc00.fonetica.api.LdocePronForm;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceOptions;
import com.dmc00.fonetica.api.SentenceWord;
import com.dmc00.fonetica.ldoce.LdoceParser;
import java.util.List;
import java.util.Objects;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Portado de {@code electron/test/sentence.test.ts}: transcripción de oraciones. */
class SentenceTest {

    private static final Lexicon LEXICON = TestFiles.britfone();
    private static final SentenceOptions CONNECTED = new SentenceOptions(true, List.of(), List.of());

    private static SentenceAnalysis analyze(String text, SentenceOptions options) {
        return Sentence.analyzeSentence(text, options, StudyTest.LOCAL_ONLY);
    }

    private static SentenceAnalysis analyze(String text) {
        return analyze(text, CONNECTED);
    }

    private static SentenceWord word(String key, String sentence, SentenceOptions options, int occurrence) {
        return analyze(sentence, options).words().stream()
                .filter(w -> w.getKey().equals(key))
                .skip(occurrence)
                .findFirst()
                .orElseThrow();
    }

    private static SentenceWord word(String key, String sentence) {
        return word(key, sentence, CONNECTED, 0);
    }

    private static int indexOf(String key, String sentence) {
        return analyze(sentence).words().stream().filter(w -> w.getKey().equals(key)).findFirst().orElseThrow().getIndex();
    }

    @Test
    @DisplayName("separación de la oración: reconoce palabras, contracciones, pausas y preguntas")
    void separacion() {
        List<Sentence.WordToken> tokens = Sentence.tokenizeSentence("Where are you from? I'm fine, thanks.");
        assertThat(tokens).extracting(t -> t.text)
                .containsExactly("Where", "are", "you", "from", "I'm", "fine", "thanks");
        assertThat(tokens).extracting(t -> Objects.requireNonNullElse(t.pauseAfter, ""))
                .containsExactly("", "", "", "||", "", "|", "||");
        assertThat(tokens).extracting(t -> t.sentenceInitial)
                .containsExactly(true, false, false, false, true, false, false);
        assertThat(tokens.get(0).question).isTrue();
        assertThat(tokens.get(5).question).isFalse();
    }

    @Nested
    @DisplayName("function words: forma débil y fuerte")
    class FormaDebilYFuerte {

        @Test
        @DisplayName("\"the\" es débil /ðə/ ante consonante y /ði/ ante vocal")
        void the() {
            assertThat(word("the", "The cat sat on the mat.").getPron()).isEqualTo("ðə");
            SentenceWord beforeVowel = word("the", "I ate the apple.");
            assertThat(beforeVowel.getPron()).isEqualTo("ði");
            assertThat(beforeVowel.getFunctionWord().getForm()).isEqualTo("weak");
        }

        @Test
        @DisplayName("al final de la oración va fuerte, salvo los pronombres")
        void alFinal() {
            SentenceWord from = word("from", "Where are you from?");
            assertThat(from.getFunctionWord().getForm()).isEqualTo("strong");
            assertThat(from.getPron()).isEqualTo("frɒm");
            assertThat(word("are", "Where are you from?").getPron()).isEqualTo("ə");
            SentenceWord her = word("her", "I gave it to her.");
            assertThat(her.getFunctionWord().getForm()).isEqualTo("weak");
            assertThat(her.getPron()).as("sin /h/ en el medio de la oración").isEqualTo("ə");
        }

        @Test
        @DisplayName("\"to\" ante vocal (incluida la \"her\" sin /h/) pasa a /tʊ/")
        void toAnteVocal() {
            assertThat(word("to", "I gave it to her.").getPron()).isEqualTo("tʊ");
            assertThat(word("to", "I want to go.").getPron()).isEqualTo("tə");
        }

        @Test
        @DisplayName("la /h/ se pronuncia al comienzo de la oración")
        void hInicial() {
            assertThat(word("her", "Her car is red.").getPron()).isEqualTo("hə");
        }

        @Test
        @DisplayName("\"there\" existencial es débil (con r de enlace) y de lugar es fuerte")
        void there() {
            SentenceWord first = word("there", "There is a book over there.");
            assertThat(first.getFunctionWord().getForm()).isEqualTo("weak");
            assertThat(first.getPron()).isEqualTo("ðə");
            assertThat(first.isLinkingR()).isTrue();
            assertThat(word("there", "There is a book over there.", CONNECTED, 1).getPron()).isEqualTo("ðeə");
        }

        @Test
        @DisplayName("\"have\" auxiliar es débil y como verbo principal es fuerte")
        void have() {
            assertThat(word("have", "I have seen it.").getPron()).isEqualTo("əv");
            assertThat(word("have", "I have a car.").getFunctionWord().getForm()).isEqualTo("strong");
        }

        @Test
        @DisplayName("el alumno puede marcar una palabra como enfatizada")
        void enfatizada() {
            String sentence = "I want to go.";
            SentenceWord forced = word("to", sentence,
                    new SentenceOptions(true, List.of(indexOf("to", sentence)), List.of()), 0);
            assertThat(forced.getPron()).isEqualTo("tuː");
            assertThat(forced.getFunctionWord().isForced()).isTrue();
        }

        @Test
        @DisplayName("y también sin énfasis, para corregir los casos ambiguos (that conjunción)")
        void sinEnfasis() {
            String sentence = "I know that.";
            assertThat(word("that", sentence).getPron()).isEqualTo("ðæt");
            assertThat(word("that", sentence, new SentenceOptions(true, List.of(), List.of(indexOf("that", sentence))), 0)
                    .getPron()).isEqualTo("ðət");
        }

        @Test
        @DisplayName("sin habla conectada todo va en forma de cita y sin r de enlace")
        void formaDeCita() {
            SentenceAnalysis result = analyze("There is a lot of water in it.", new SentenceOptions(false, List.of(), List.of()));
            assertThat(result.words()).filteredOn(w -> w.getFunctionWord() != null)
                    .allMatch(w -> w.getFunctionWord().getForm().equals("strong"));
            assertThat(result.words()).noneMatch(SentenceWord::isLinkingR);
        }
    }

    @Nested
    @DisplayName("habla conectada y palabras derivadas")
    class Derivadas {

        @Test
        @DisplayName("agrega la r de enlace entre vocales (far away)")
        void rDeEnlace() {
            SentenceAnalysis result = analyze("It is far away.");
            assertThat(result.words().stream().filter(w -> w.getKey().equals("far")).findFirst().orElseThrow().isLinkingR())
                    .isTrue();
            assertThat(result.transcription()).contains("fɑːr ");
        }

        @Test
        @DisplayName("marca las pausas en la transcripción")
        void pausas() {
            assertThat(analyze("Yes, I can. Thanks.").transcription()).containsPattern(" \\| .* \\|\\| ");
        }

        @Test
        @DisplayName("arma palabras que no están en el diccionario a partir de la base")
        void derivadas() {
            SentenceWord watered = word("watered", "I watered the plants.");
            assertThat(watered.getSource()).isEqualTo("derived");
            assertThat(watered.getPron()).isEqualTo("ˈwɔːtəd");
            assertThat(word("watering", "She is watering them.").getPron()).isEqualTo("ˈwɔːtərɪŋ");
        }
    }

    @Nested
    @DisplayName("formas de Longman")
    class FormasDeLongman {

        private static final String PAGE = """
                <span class="ldoceEntry Entry"><span class="Head"><span class="HWD">the</span>
                    <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">ðə</span><span class="STRONG"><span class="neutral span">; </span>before vowels</span><span class="PRON"> ði</span><span class="STRONG"><span class="neutral span">; </span>strong</span><span class="PRON"> ðiː</span><span class="neutral span">/</span></span>
                    <span class="POS"> definite article</span></span></span>""";

        @Test
        @DisplayName("el parser separa las formas etiquetadas")
        void parserSeparaFormas() {
            var entry = LdoceParser.parseEntryPage(PAGE).getFirst();
            assertThat(entry.pronBrE()).isEqualTo("ðə");
            assertThat(entry.pronFormsBrE()).containsExactly(
                    new LdocePronForm(null, "ðə"),
                    new LdocePronForm("before vowels", "ði"),
                    new LdocePronForm("strong", "ðiː"));
        }

        @Test
        @DisplayName("las formas que siguen a la variante americana ($) no se mezclan con las británicas")
        void varianteAmericana() {
            String forPage = """
                    <span class="ldoceEntry Entry"><span class="Head"><span class="HWD">for</span>
                      <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">fə</span><span class="STRONG"><span class="neutral span">; </span>strong</span><span class="PRON"> fɔː</span><span class="AMEVARPRON"><span class="neutral span"> $ </span>fər</span><span class="STRONG"> strong</span><span class="PRON"> fɔːr</span><span class="neutral span">/</span></span>
                      <span class="POS"> preposition</span></span></span>""";
            var entry = LdoceParser.parseEntryPage(forPage).getFirst();
            assertThat(entry.pronFormsBrE()).containsExactly(new LdocePronForm(null, "fə"), new LdocePronForm("strong", "fɔː"));
            assertThat(entry.pronAmE()).isEqualTo("fər");
        }

        @Test
        @DisplayName("cuando Longman ya respondió, sus formas reemplazan a la tabla")
        void longmanReemplazaALaTabla() {
            LdoceLookup lookup = new LdoceLookup("the", "found", LdoceParser.parseEntryPage(PAGE), List.of(), null, null,
                    true, null);
            FunctionWords.Forms forms = Sentence.longmanFormsFromLookup(lookup);
            assertThat(forms).isEqualTo(new FunctionWords.Forms("artículo", List.of("ðə"), "ði", "ðiː"));
            Sentence.Deps deps = new Sentence.Deps() {
                @Override
                public Prons pronsOf(String w) {
                    return LEXICON.pronsOf(w);
                }

                @Override
                public FunctionWords.Forms longmanForms(String w) {
                    return w.equals("the") ? forms : null;
                }
            };
            SentenceWord the = Sentence.analyzeSentence("The end.", CONNECTED, deps).words().getFirst();
            assertThat(the.getSource()).isEqualTo("ldoce");
            assertThat(the.getFunctionWord().isFromLongman()).isTrue();
            assertThat(the.getPron()).isEqualTo("ði");
        }
    }
}
