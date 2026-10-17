# Clases del motor Java (sidecar-java/)

Paquete raíz `com.dmc00.fonetica`. Un diagrama por paquete; los records del contrato JSON (`api/`) no se
dibujan: tienen las mismas formas que `shared/fonetica-api.ts`.

## Arranque y protocolo

```mermaid
classDiagram
    direction LR
    class SidecarMain {
        +main(args)
    }
    class JsonLineServer {
        +serve(in, out, readyInfo)
        ~answer(line) Map
    }
    class Handlers {
        +handle(channel, args) Result
        +applyLookupToLexicon(lexicon, status, entries)$
    }
    class Input {
        <<validación>>
        text(value, max)$
        indexes(value)$
        count(value, fallback)$
        tokens(value, valid, max)$
    }
    class Result {
        <<sealed>>
    }
    SidecarMain --> JsonLineServer : atiende stdin/stdout
    JsonLineServer --> Handlers : un hilo virtual por pedido
    Handlers ..> Input
    Handlers ..> Result : Json o Bytes
    Handlers --> Lexicon
    Handlers --> LdoceClient
    Handlers --> PiperVoice : null si no hay voz
    Handlers --> NlpClient : null si no hay spaCy
    SidecarMain ..> LdoceCache : al iniciar carga sus consultas en el léxico
```

## core

```mermaid
classDiagram
    direction LR
    class Lexicon {
        +loadBritfone(csv)
        +upsertFromLdoce(headword, prons)
        +pronsOf(word) Prons
        +searchSpelling(query, limit) List~SpellingHit~
        +searchPhonemes(written, useStress, limit) List~PhonemeMatch~
        +info() LexiconInfo
    }
    class Distance {
        +osaDistance(a, b, max)$
        +phonemeDistance(written, expected, max)$
        +phonemeAlignment(written, expected)$
    }
    class Transcription {
        +expandLongmanAlternatives(pron)$
        +expandOptionalSounds(pron)$
        +parseLongmanPron(pron)$ List~PronVariant~
        +britfoneToLongman(phonemes)$
    }
    class Ipa {
        +normalizeIpa(text)$
        +tokenize(text)$ Tokens
        +toVariant(tokens)$ PronVariant
    }
    class PhonemeInventory {
        +PHONEMES$
        +isVowel(symbol)$
    }
    class Sentence {
        +analyzeSentence(text, options, deps)$ SentenceAnalysis
        +longmanFormsFromLookup(lookup)$ Forms
    }
    class FunctionWords {
        +FUNCTION_WORDS$
        +decideForm(context)$ Decision
        +pickWeakForm(...)$
    }
    class ConnectedSpeech {
        +detectProcesses(words)$
    }
    class StudyTools {
        +checkTranscription(written, expected)$
        +inflections(verb, pronsOf)$
    }
    class JsStrings {
        <<misma semántica que JavaScript>>
    }
    Lexicon --> Transcription
    Lexicon --> Distance
    Transcription --> Ipa
    Ipa --> PhonemeInventory
    Sentence --> FunctionWords
    Sentence --> ConnectedSpeech
    Sentence ..> Lexicon : Deps.pronsOf
    StudyTools --> Distance
    StudyTools --> Sentence : sEnding / edEnding
```

## ldoce y tts

```mermaid
classDiagram
    direction LR
    class LdoceClient {
        +LDOCE_ORIGIN$
        +lookup(query) LdoceLookup
        +cached(query) LdoceLookup
        +audio(url) byte[]
        -throttled(request) 1 pedido por segundo
    }
    class Fetcher {
        <<interface>>
        +fetch(url, headers) Response
    }
    class JdkFetcher
    class LdoceParser {
        +PARSER_VERSION$ = 3
        +parseEntryPage(html)$ List~LdoceEntry~
        +parseSpellcheckPage(html)$ List~String~
    }
    class LdoceCache {
        +get(query) StoredLookup
        +set(query, lookup)
        +all() List~StoredLookup~
        +flush()
    }
    class AudioCache {
        +read(url) byte[]
        +write(url, bytes)
    }
    class PiperVoice {
        +synthesize(phonemes, lengthScale) byte[]
        +phonemesToIds(phonemes, map)$
        +encodeWav(samples, sampleRate)$
    }
    class EspeakNotation {
        +wordToEspeak(pron, stress)$
        +sentenceToEspeak(text, analysis, withProcesses)$
    }
    Fetcher <|.. JdkFetcher
    LdoceClient --> Fetcher
    LdoceClient --> LdoceParser
    LdoceClient --> LdoceCache
    LdoceClient --> AudioCache
    EspeakNotation ..> PiperVoice : fonemas eSpeak
```

## grammar

```mermaid
classDiagram
    direction LR
    class NlpClient {
        +locate(resources, project, json)$ NlpClient
        +parse(text) List~ParsedToken~
        +close()
    }
    class ParsedToken {
        <<record>>
        int i
        String dep
        int head
        String pos
        String tag
    }
    class QuirkAnalysis {
        +analyzeGrammar(tokens)$ GrammarAnalysis
    }
    class ClauseAnalysis {
        String kind
        String pattern
        List~ClauseElement~ elements
        VerbPhraseAnalysis verbPhrase
    }
    class ClauseElement {
        String role
        String form
        Boolean obligatory
        List~StructurePart~ structure
    }
    class GrammarModel {
        <<records>>
        TokenSpan
        GrammarToken
        StructurePart
        VerbPhraseAnalysis
        SentenceGrammar
        GrammarAnalysis
    }
    NlpClient ..> ParsedToken : spaCy por stdin/stdout
    QuirkAnalysis ..> ParsedToken
    QuirkAnalysis ..> ClauseAnalysis
    ClauseAnalysis "1" *-- "*" ClauseElement
    ClauseElement --> ClauseAnalysis : si es una cláusula
    QuirkAnalysis ..> GrammarModel
```
