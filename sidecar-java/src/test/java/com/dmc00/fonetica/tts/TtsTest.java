package com.dmc00.fonetica.tts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceOptions;
import com.dmc00.fonetica.core.FunctionWords;
import com.dmc00.fonetica.core.Lexicon;
import com.dmc00.fonetica.core.PhonemeInventory;
import com.dmc00.fonetica.core.Sentence;
import com.dmc00.fonetica.tts.EspeakNotation.StressMode;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Portado de {@code electron/test/tts.test.ts}: notación eSpeak y entrada/salida del modelo de Piper. */
class TtsTest {

    private static final Lexicon LEXICON = TestFiles.britfone();
    private static final Path MODEL = TestFiles.resources().resolve("piper").resolve("en_GB-cori-high.onnx");

    @Nested
    @DisplayName("notación eSpeak para la voz")
    class Notacion {

        @Test
        @DisplayName("convierte símbolos y corre el acento antes de la vocal")
        void conversion() {
            assertThat(EspeakNotation.wordToEspeak("kəmˈpjuːtə", StressMode.KEEP)).isEqualTo("kəmpjˈuːtə");
            assertThat(EspeakNotation.wordToEspeak("kæt", StressMode.ENSURE)).isEqualTo("kˈat");
            assertThat(EspeakNotation.wordToEspeak("hɪə", StressMode.ENSURE)).isEqualTo("hˈiə");
            assertThat(EspeakNotation.wordToEspeak("ˈred", StressMode.ENSURE)).isEqualTo("ɹˈɛd");
            assertThat(EspeakNotation.wordToEspeak("ðə", StressMode.NONE)).isEqualTo("ðə");
            assertThat(EspeakNotation.wordToEspeak("ˈɡʌv(ə)mənt", StressMode.KEEP)).isEqualTo("ɡˈʌvəmənt");
        }

        // Calibración contra eSpeak (la notación con la que se entrenó la voz): las palabras de ejemplo de la
        // tabla fonémica tienen que quedar igual que como las escribe eSpeak. Lo que escribe eSpeak está
        // guardado en espeak-calibracion.json (se sacó con el paquete phonemizer, variante "en").
        @Test
        @DisplayName("coincide con eSpeak en las palabras de la tabla fonémica")
        void calibracion() {
            JsonNode espeak = TestFiles.resourceJson("espeak-calibracion.json");
            // Diferencias de diccionario, no de notación: Britfone y eSpeak transcriben distinto estas palabras.
            Set<String> known = Set.of("situation", "television", "video", "teacher", "tourist", "shall");
            List<String> mismatches = new ArrayList<>();
            for (PhonemeInventory.Phoneme phoneme : PhonemeInventory.PHONEMES) {
                String example = phoneme.example();
                if (known.contains(example)) continue;
                Prons prons = LEXICON.pronsOf(example);
                if (prons == null) continue;
                String ours = EspeakNotation.wordToEspeak(prons.prons().getFirst(), StressMode.ENSURE);
                String theirs = espeak.get(example).asString();
                if (!ours.equals(theirs)) mismatches.add(example + ": " + ours + " ≠ " + theirs);
            }
            assertThat(mismatches).isEmpty();
        }

        @Test
        @DisplayName("la oración lleva las formas elegidas, el acento de las palabras de contenido y la puntuación")
        void oracion() {
            String text = "Where are you from?";
            SentenceAnalysis analysis = Sentence.analyzeSentence(text, new SentenceOptions(true, List.of(), List.of()),
                    new Sentence.Deps() {
                        @Override
                        public Prons pronsOf(String word) {
                            return LEXICON.pronsOf(word);
                        }

                        @Override
                        public FunctionWords.Forms longmanForms(String word) {
                            return null;
                        }
                    });
            assertThat(EspeakNotation.sentenceToEspeak(text, analysis, false)).isEqualTo("wˈeəɹ ə juː fɹˈɒm?");
        }
    }

    @Nested
    @DisplayName("entrada y salida del modelo")
    class Modelo {

        @Test
        @DisplayName("arma la secuencia ^ _ f _ f _ $")
        void secuencia() {
            Map<String, List<Integer>> map = Map.of("^", List.of(1), "$", List.of(2), "_", List.of(0),
                    "k", List.of(23), "a", List.of(14), "t", List.of(32));
            assertThat(PiperVoice.phonemesToIds("kat", map)).containsExactly(1, 0, 23, 0, 14, 0, 32, 0, 2);
        }

        @Test
        @DisplayName("genera un WAV de 16 bits normalizado")
        void wav() {
            byte[] wav = PiperVoice.encodeWav(new float[] {0, 0.5f, -0.25f}, 22050);
            ByteBuffer view = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
            assertThat(new String(wav, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
            assertThat(view.getInt(24)).isEqualTo(22050);
            assertThat(view.getShort(46)).isEqualTo((short) 32767);
            assertThat(wav).hasSize(44 + 6);
        }

        @Test
        @DisplayName("sintetiza una oración con la voz instalada")
        void sintetiza() throws Exception {
            assumeTrue(PiperVoice.isInstalled(MODEL), "la voz no está instalada (npm run fetch-voice)");
            try (PiperVoice voice = new PiperVoice(MODEL, TestFiles.JSON)) {
                byte[] wav = voice.synthesize("ðə kˈat sˈat ɒn ðə mˈat.", null);
                double seconds = (wav.length - 44) / 2.0 / 22050;
                assertThat(seconds).as("duración %.2f s", seconds).isBetween(0.8, 4.0);
                byte[] slow = voice.synthesize("ðə kˈat sˈat ɒn ðə mˈat.", 1.45f);
                assertThat(slow.length).as("el modo lento dura más").isGreaterThan((int) (wav.length * 1.2));
            }
        }
    }
}
