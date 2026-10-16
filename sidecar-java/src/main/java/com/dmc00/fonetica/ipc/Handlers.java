package com.dmc00.fonetica.ipc;

import static com.dmc00.fonetica.core.PhonemeInventory.PRIMARY_STRESS;
import static com.dmc00.fonetica.core.PhonemeInventory.SECONDARY_STRESS;

import com.dmc00.fonetica.api.LdoceEntry;
import com.dmc00.fonetica.api.LdoceLookup;
import com.dmc00.fonetica.api.LdocePronForm;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SentenceAnalysis;
import com.dmc00.fonetica.api.SentenceOptions;
import com.dmc00.fonetica.core.FunctionWords;
import com.dmc00.fonetica.core.Lexicon;
import com.dmc00.fonetica.core.PhonemeInventory;
import com.dmc00.fonetica.core.Sentence;
import com.dmc00.fonetica.core.StudyTools;
import com.dmc00.fonetica.grammar.NlpClient;
import com.dmc00.fonetica.grammar.QuirkAnalysis;
import com.dmc00.fonetica.ldoce.LdoceClient;
import com.dmc00.fonetica.tts.EspeakNotation;
import com.dmc00.fonetica.tts.EspeakNotation.StressMode;
import com.dmc00.fonetica.tts.PiperVoice;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;

/**
 * Los canales IPC que atiende el motor: el mismo contrato que {@code shared/fonetica-api.ts}. Electron
 * valida y reenvía; acá se vuelve a validar (tipos, largos, fonemas conocidos) antes de usar la entrada.
 *
 * <p>Los canales {@code shell:open-in-browser} y {@code window:set-theme} quedan en Electron.
 */
public class Handlers {

    /** Lo que devuelve un canal: un objeto que se escribe como JSON, o bytes (audio) que van en base64. */
    public sealed interface Result permits Json, Bytes {
    }

    public record Json(Object value) implements Result {
    }

    public record Bytes(byte[] value) implements Result {
    }

    /** Duración de los fonemas en modo lento (1 = normal). */
    private static final float SLOW_LENGTH_SCALE = 1.45f;

    private static final Set<String> VALID_TOKENS = new HashSet<>(PhonemeInventory.symbols());

    static {
        VALID_TOKENS.add(PRIMARY_STRESS);
        VALID_TOKENS.add(SECONDARY_STRESS);
    }

    private final Lexicon lexicon;
    private final LdoceClient ldoce;
    /** null si la voz no está instalada (npm run fetch-voice). */
    private final PiperVoice voice;
    /** null si el analizador gramatical no está (npm run build:nlp). */
    private final NlpClient nlp;

    public Handlers(Lexicon lexicon, LdoceClient ldoce, PiperVoice voice, NlpClient nlp) {
        this.lexicon = lexicon;
        this.ldoce = ldoce;
        this.voice = voice;
        this.nlp = nlp;
    }

    /** Atiende un pedido. Los errores de validación o de ejecución salen como excepción con su mensaje. */
    public Result handle(String channel, JsonNode args) throws Exception {
        return switch (channel) {
            case "lexicon:search-spelling" -> json(lexicon.searchSpelling(Input.text(arg(args, 0), 60),
                    Input.count(arg(args, 1), 25)));
            case "lexicon:search-phonemes" -> json(lexicon.searchPhonemes(
                    Input.tokens(arg(args, 0), VALID_TOKENS, 40),
                    Input.isTrue(arg(args, 1).get("useStress")),
                    Input.count(arg(args, 1).get("limit"), 40)));
            case "lexicon:info" -> json(lexicon.info());
            case "ldoce:lookup" -> {
                LdoceLookup lookup = ldoce.lookup(Input.text(arg(args, 0), 60));
                applyLookupToLexicon(lexicon, lookup);
                yield json(lookup);
            }
            case "ldoce:audio" -> new Bytes(ldoce.audio(Input.text(arg(args, 0), 300)));
            case "sentence:analyze" -> json(analyze(Input.text(arg(args, 0), 500), arg(args, 1)));
            case "tts:available" -> json(voice != null);
            // La voz lee la misma transcripción que se muestra: con las formas débiles/fuertes elegidas.
            case "tts:sentence" -> {
                String sentence = Input.text(arg(args, 0), 500);
                JsonNode options = arg(args, 1);
                PiperVoice speaker = requireVoice();
                String phonemes = EspeakNotation.sentenceToEspeak(sentence, analyze(sentence, options),
                        Input.isTrue(options.get("processes")));
                yield new Bytes(speaker.synthesize(phonemes, lengthScale(options)));
            }
            case "tts:phonemes" -> new Bytes(requireVoice().synthesize(
                    EspeakNotation.wordToEspeak(Input.text(arg(args, 0), 200), StressMode.ENSURE) + ".",
                    lengthScale(arg(args, 1))));
            case "lexicon:prons-of" -> {
                Map<String, Prons> result = new LinkedHashMap<>();
                for (String word : Input.strings(arg(args, 0), w -> true, 500)) {
                    result.put(word, lexicon.pronsOf(word.length() > 60 ? word.substring(0, 60) : word));
                }
                yield json(result);
            }
            case "lexicon:check-transcription" -> json(StudyTools.checkTranscription(
                    Input.tokens(arg(args, 0), VALID_TOKENS, 60), Input.text(arg(args, 1), 200)));
            case "lexicon:inflections" -> json(StudyTools.inflections(Input.text(arg(args, 0), 40), lexicon::pronsOf));
            case "grammar:available" -> json(nlp != null);
            case "grammar:analyze" -> {
                if (nlp == null) {
                    throw new IllegalStateException("El analizador gramatical no está instalado (npm run build:nlp).");
                }
                yield json(QuirkAnalysis.analyzeGrammar(nlp.parse(Input.text(arg(args, 0), 1000))));
            }
            default -> throw new IllegalArgumentException("Canal desconocido: " + channel);
        };
    }

    private SentenceAnalysis analyze(String sentence, JsonNode options) {
        SentenceOptions opts = new SentenceOptions(
                Input.isNotFalse(options.get("connected")),
                Input.indexes(options.get("forcedStrong")),
                Input.indexes(options.get("forcedWeak")));
        return Sentence.analyzeSentence(sentence, opts, new Sentence.Deps() {
            @Override
            public Prons pronsOf(String word) {
                return lexicon.pronsOf(word);
            }

            @Override
            public FunctionWords.Forms longmanForms(String word) {
                return Sentence.longmanFormsFromLookup(ldoce.cached(word));
            }
        });
    }

    private PiperVoice requireVoice() {
        if (voice == null) throw new IllegalStateException("La voz británica no está instalada (npm run fetch-voice).");
        return voice;
    }

    private static Float lengthScale(JsonNode options) {
        return Input.isTrue(options.get("slow")) ? SLOW_LENGTH_SCALE : 1f;
    }

    /** El argumento n-ésimo; si no vino, un nodo vacío (como {@code undefined} en JavaScript). */
    private static JsonNode arg(JsonNode args, int index) {
        JsonNode value = args == null ? null : args.get(index);
        return value == null || value.isNull() ? MissingNode.getInstance() : value;
    }

    private static Json json(Object value) {
        return new Json(value);
    }

    /** Las palabras consultadas en Longman pasan a usar su transcripción también en la búsqueda por fonemas. */
    public static void applyLookupToLexicon(Lexicon lexicon, String status, List<LdoceEntry> entries) {
        if (!"found".equals(status)) return;
        // Agrupa por palabra sin distinguir mayúsculas ("record" sustantivo y verbo tienen dos pronunciaciones).
        Map<String, String> headwords = new LinkedHashMap<>();
        Map<String, List<String>> prons = new LinkedHashMap<>();
        for (LdoceEntry entry : entries) {
            if (entry.pronBrE() == null || entry.pronBrE().isEmpty()) continue;
            String key = Lexicon.normalizeKey(entry.headword());
            headwords.putIfAbsent(key, entry.headword());
            List<String> group = prons.computeIfAbsent(key, k -> new ArrayList<>());
            if (entry.pronFormsBrE() != null) {
                for (LdocePronForm form : entry.pronFormsBrE()) group.add(form.pron());
            } else {
                group.add(entry.pronBrE());
            }
        }
        for (Map.Entry<String, List<String>> group : prons.entrySet()) {
            lexicon.upsertFromLdoce(headwords.get(group.getKey()), group.getValue());
        }
    }

    private static void applyLookupToLexicon(Lexicon lexicon, LdoceLookup lookup) {
        applyLookupToLexicon(lexicon, lookup.status(), lookup.entries());
    }
}
