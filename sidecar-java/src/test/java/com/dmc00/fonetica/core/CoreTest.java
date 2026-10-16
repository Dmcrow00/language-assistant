package com.dmc00.fonetica.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.api.AlignmentStep;
import com.dmc00.fonetica.api.PhonemeMatch;
import com.dmc00.fonetica.api.SpellingHit;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Portado de {@code electron/test/core.test.ts}: notación, transcripciones de Longman, distancias y léxico. */
class CoreTest {

    private static List<String> tokens(String ipa) {
        return Ipa.tokenize(ipa).tokens();
    }

    private static List<String> segments(String ipa) {
        return Ipa.toVariant(tokens(ipa)).segments();
    }

    @Nested
    @DisplayName("tokenize")
    class Tokenize {

        @Test
        @DisplayName("reconoce diptongos, africadas y vocales largas como un solo fonema")
        void diptongosYAfricadas() {
            assertThat(tokens("ˈtʃaɪəˈθiːə")).containsExactly("ˈ", "tʃ", "aɪ", "ə", "ˈ", "θ", "iː", "ə");
        }

        @Test
        @DisplayName("pasa la IPA estricta y el tipeo ASCII a la notación de Longman")
        void notacionLongman() {
            assertThat(tokens("ɹ'ɛd")).containsExactly("r", "ˈ", "e", "d");
            assertThat(tokens("fɑ:")).containsExactly("f", "ɑː");
        }

        @Test
        @DisplayName("anota qué vocal lleva el acento principal")
        void vocalAcentuada() {
            assertThat(Ipa.toVariant(tokens("kəmˈpjuːtə")))
                    .isEqualTo(new PronVariant(List.of("k", "ə", "m", "p", "j", "uː", "t", "ə"), 1));
        }
    }

    @Nested
    @DisplayName("transcripciones de Longman")
    class Longman {

        @Test
        @DisplayName("expande las alternativas abreviadas con guion")
        void alternativasAbreviadas() {
            assertThat(Transcription.expandLongmanAlternatives("ˈʃedjuːl, ˈske-"))
                    .containsExactly("ˈʃedjuːl", "ˈskedjuːl");
            assertThat(Transcription.expandLongmanAlternatives("ˈkʌmftəb(ə)l, ˈkʌmfət-"))
                    .containsExactly("ˈkʌmftəb(ə)l", "ˈkʌmfətəb(ə)l");
            assertThat(Transcription.expandLongmanAlternatives("ˈskedʒʊl, -dʒ(ə)l"))
                    .containsExactly("ˈskedʒʊl", "ˈskedʒ(ə)l");
        }

        @Test
        @DisplayName("genera las versiones con y sin sonidos opcionales")
        void sonidosOpcionales() {
            assertThat(Transcription.expandOptionalSounds("ˈɡʌv(ə)mənt")).containsExactly("ˈɡʌvəmənt", "ˈɡʌvmənt");
            assertThat(Transcription.parseLongmanPron("ˈɡʌv(ə)mənt, ˈɡʌv(ə)nmənt")).hasSize(4);
        }
    }

    @Test
    @DisplayName("Britfone → Longman: corre el acento al comienzo de la sílaba y cambia los símbolos")
    void britfoneALongman() {
        assertThat(Transcription.britfoneToLongman("k ə m p j ˈuː t ə")).isEqualTo("kəmˈpjuːtə");
        assertThat(Transcription.britfoneToLongman("w ˈɔː t ə")).isEqualTo("ˈwɔːtə");
        assertThat(Transcription.britfoneToLongman("ɹ ˈɛ d"))
                .as("los monosílabos van sin marca, como en Longman")
                .isEqualTo("red");
        assertThat(Transcription.britfoneToLongman("ɐ n d ə s t ˈæ n d")).isEqualTo("ʌndəˈstænd");
        assertThat(Transcription.britfoneToLongman("ɪ k s t ɹ ˈiː m")).isEqualTo("ɪkˈstriːm");
    }

    @Nested
    @DisplayName("distancia entre fonemas")
    class Distancia {

        @Test
        @DisplayName("es 0 para la misma secuencia y chica para vocales vecinas")
        void vocalesVecinas() {
            assertThat(Distance.phonemeDistance(segments("kæt"), segments("kæt"))).isZero();
            assertThat(Distance.phonemeDistance(segments("ʃɪp"), segments("ʃiːp")))
                    .isLessThan(Distance.phonemeDistance(segments("ʃɪp"), segments("ʃɑːp")));
        }

        @Test
        @DisplayName("una /r/ agregada cuesta poco (water → /wɔːtər/)")
        void rAgregada() {
            assertThat(Distance.phonemeDistance(segments("wɔːtər"), segments("wɔːtə"))).isLessThanOrEqualTo(0.5);
        }

        @Test
        @DisplayName("explica qué fonemas no coinciden")
        void alineacion() {
            List<AlignmentStep> steps = Distance.phonemeAlignment(segments("ket"), segments("kæt")).steps();
            assertThat(steps).extracting(AlignmentStep::op).containsExactly("match", "substituted", "match");
            assertThat(steps.get(1)).isEqualTo(AlignmentStep.substituted("æ", "e"));
            assertThat(Distance.phonemeAlignment(segments("kæts"), segments("kæt")).steps())
                    .extracting(AlignmentStep::op)
                    .containsExactly("match", "match", "match", "extra");
            assertThat(Distance.phonemeAlignment(segments("ʃip"), segments("ʃiːp")).steps().get(1).op())
                    .isEqualTo("substituted");
        }
    }

    @Nested
    @DisplayName("Lexicon con Britfone")
    class LexiconConBritfone {

        private final Lexicon lexicon = TestFiles.britfone();

        @Test
        @DisplayName("carga más de 15 000 palabras")
        void cargaBritfone() {
            assertThat(lexicon.size()).isGreaterThan(15000);
        }

        @Test
        @DisplayName("corrige errores de tipeo")
        void erroresDeTipeo() {
            assertThat(lexicon.searchSpelling("watre", 25).getFirst().word()).isEqualTo("water");
            assertThat(lexicon.searchSpelling("recieve", 25).getFirst().word()).isEqualTo("receive");
            assertThat(lexicon.searchSpelling("water", 25).getFirst().kind()).isEqualTo("exact");
        }

        @Test
        @DisplayName("una palabra que sólo \"suena parecido\" no le gana a una con menos letras cambiadas")
        void sonidoNoGanaALetras() {
            List<String> words = lexicon.searchSpelling("watered", 25).stream().map(SpellingHit::word).toList();
            assertThat(words.indexOf("waters")).isLessThan(words.indexOf("retired"));
        }

        @Test
        @DisplayName("encuentra palabras escritas \"como suenan\"")
        void comoSuenan() {
            assertThat(Lexicon.soundKey("phonetic")).isEqualTo(Lexicon.soundKey("fonetik"));
            assertThat(lexicon.searchSpelling("fonetik", 25)).extracting(SpellingHit::word).contains("phonetic");
        }

        @Test
        @DisplayName("encuentra homófonos por fonemas")
        void homofonos() {
            List<String> words = lexicon.searchPhonemes(tokens("nəʊ"), false, 40).stream()
                    .filter(PhonemeMatch::exact)
                    .map(PhonemeMatch::word)
                    .toList();
            assertThat(words).contains("know", "no");
        }

        @Test
        @DisplayName("ubica la palabra aunque el alumno se equivoque en un fonema")
        void unFonemaMal() {
            List<String> top = lexicon.searchPhonemes(tokens("ˈwɔːtər"), false, 40).stream()
                    .limit(5)
                    .map(PhonemeMatch::word)
                    .toList();
            assertThat(top).contains("water");
        }

        @Test
        @DisplayName("con acento activado penaliza la sílaba equivocada")
        void acentoEquivocado() {
            PhonemeMatch right = lexicon.searchPhonemes(tokens("ˈwɔːtə"), true, 40).stream()
                    .filter(m -> m.word().equals("water")).findFirst().orElseThrow();
            PhonemeMatch wrong = lexicon.searchPhonemes(tokens("wɔːˈtə"), true, 40).stream()
                    .filter(m -> m.word().equals("water")).findFirst().orElseThrow();
            assertThat(right.distance()).isZero();
            assertThat(wrong.stressMismatch()).isTrue();
        }

        @Test
        @DisplayName("las transcripciones de Longman reemplazan a las de Britfone")
        void longmanReemplazaABritfone() {
            Lexicon own = TestFiles.newBritfoneLexicon();
            own.upsertFromLdoce("schedule", List.of("ˈʃedjuːl, ˈske-"));
            PhonemeMatch match = own.searchPhonemes(tokens("ˈskedjuːl"), false, 40).getFirst();
            assertThat(match.word()).isEqualTo("schedule");
            assertThat(match.source()).isEqualTo("ldoce");
            assertThat(match.exact()).isTrue();
        }
    }
}
