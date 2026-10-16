package com.dmc00.fonetica.grammar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.dmc00.fonetica.TestFiles;
import com.dmc00.fonetica.grammar.GrammarModel.SentenceGrammar;
import com.dmc00.fonetica.grammar.GrammarModel.StructurePart;
import com.dmc00.fonetica.grammar.GrammarModel.VerbPart;
import com.dmc00.fonetica.grammar.GrammarModel.VerbPhraseAnalysis;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;

/**
 * Portado de {@code electron/test/grammar.test.ts}. Usa respuestas reales de spaCy (en_core_web_sm 3.8.0)
 * guardadas en {@code spacy-parses.json}: no necesita Python. Las dos pruebas del final usan el analizador
 * real y se saltean si no está instalado.
 */
class GrammarTest {

    private static final JsonNode PARSES = TestFiles.resourceJson("spacy-parses.json");
    private static final TypeReference<List<ParsedToken>> TOKENS = new TypeReference<>() {
    };

    static List<ParsedToken> parsed(String sentence) {
        JsonNode tokens = PARSES.get(sentence);
        assertThat(tokens).as("falta el análisis de «%s» en el fixture", sentence).isNotNull();
        return TestFiles.JSON.convertValue(tokens, TOKENS);
    }

    private static SentenceGrammar analyze(String sentence) {
        return QuirkAnalysis.analyzeGrammar(parsed(sentence)).sentences().getFirst();
    }

    /** "S V Od" con el texto de cada elemento: S=«She» V=«reads» Od=«novels». */
    private static String elements(ClauseAnalysis clause) {
        return clause.getElements().stream()
                .map(e -> e.getRole() + (Boolean.TRUE.equals(e.getObligatory()) ? "*" : "") + "=«" + e.getText() + "»")
                .collect(Collectors.joining(" "));
    }

    private static ClauseElement element(ClauseAnalysis clause, String role) {
        return clause.getElements().stream().filter(e -> e.getRole().equals(role)).findFirst().orElse(null);
    }

    static Stream<Arguments> sieteTipos() {
        return Stream.of(
                Arguments.of("The children were sleeping.", "SV", "S=«The children» V=«were sleeping»"),
                Arguments.of("She reads novels.", "SVO", "S=«She» V=«reads» Od=«novels»"),
                Arguments.of("The soup tasted delicious.", "SVC", "S=«The soup» V=«tasted» Cs=«delicious»"),
                Arguments.of("My keys are in the drawer.", "SVA", "S=«My keys» V=«are» A*=«in the drawer»"),
                Arguments.of("He sent his sister a postcard.", "SVOO", "S=«He» V=«sent» Oi=«his sister» Od=«a postcard»"),
                Arguments.of("They painted the walls white.", "SVOC", "S=«They» V=«painted» Od=«the walls» Co=«white»"),
                Arguments.of("She put the keys on the table.", "SVOA", "S=«She» V=«put» Od=«the keys» A*=«on the table»"));
    }

    static Stream<Arguments> correccionesDelModelo() {
        return Stream.of(
                Arguments.of("The news made everyone happy.", "SVOC", "S=«The news» V=«made» Od=«everyone» Co=«happy»"),
                Arguments.of("I find this book boring.", "SVOC", "S=«I» V=«find» Od=«this book» Co=«boring»"),
                Arguments.of("They named their daughter Lucy.", "SVOC", "S=«They» V=«named» Od=«their daughter» Co=«Lucy»"),
                Arguments.of("She placed the vase on the table.", "SVOA", "S=«She» V=«placed» Od=«the vase» A*=«on the table»"));
    }

    static Stream<Arguments> sujetoAusenteOFueraDeLugar() {
        return Stream.of(
                // Preguntas: el sujeto va entre el auxiliar y el verbo léxico.
                Arguments.of("Did you send her the letter?", "SVOO", "V=«Did … send» S=«you» Oi=«her» Od=«the letter»"),
                Arguments.of("Where did you put my glasses?", "SVOA", "A*=«Where» V=«did … put» S=«you» Od=«my glasses»"),
                Arguments.of("What does your sister do?", "SVO", "Od=«What» V=«does … do» S=«your sister»"),
                Arguments.of("Is the museum open on Sundays?", "SVC", "V=«Is» S=«the museum» Cs=«open» A=«on Sundays»"),
                // Adverbial adelante, con o sin inversión.
                Arguments.of("Last summer we visited our grandparents.", "SVO",
                        "A=«Last summer» S=«we» V=«visited» Od=«our grandparents»"),
                Arguments.of("In the corner stood an old piano.", "SVA", "A*=«In the corner» V=«stood» S=«an old piano»"),
                Arguments.of("Here comes the bus!", "SVA", "A*=«Here» V=«comes» S=«the bus»"),
                Arguments.of("Never have I seen such a mess.", "SVO", "A=«Never» V=«have … seen» S=«I» Od=«such a mess»"),
                // Sujeto vacío "it".
                Arguments.of("It is raining.", "SV", "S=«It» V=«is raining»"),
                // Imperativas: sujeto implícito.
                Arguments.of("Put the milk in the fridge.", "SVOA", "V=«Put» Od=«the milk» A*=«in the fridge»"),
                Arguments.of("Be quiet!", "SVC", "V=«Be» Cs=«quiet»"),
                Arguments.of("Give me a hand.", "SVOO", "V=«Give» Oi=«me» Od=«a hand»"),
                Arguments.of("Don't leave the door open.", "SVOC", "V=«Don't leave» Od=«the door» Co=«open»"));
    }

    @Nested
    @DisplayName("los siete tipos de cláusula de Quirk")
    class SieteTipos {

        @ParameterizedTest(name = "{1}: {0}")
        @MethodSource("com.dmc00.fonetica.grammar.GrammarTest#sieteTipos")
        void tipo(String sentence, String pattern, String expected) {
            ClauseAnalysis clause = analyze(sentence).clauses().getFirst();
            assertThat(clause.getPattern()).isEqualTo(pattern);
            assertThat(elements(clause)).isEqualTo(expected);
        }

        @Test
        @DisplayName("corrige el error del modelo en «elected her president» (Od + Co)")
        void electedHerPresident() {
            ClauseAnalysis clause = analyze("They elected her president.").clauses().getFirst();
            assertThat(clause.getPattern()).isEqualTo("SVOC");
            assertThat(elements(clause)).isEqualTo("S=«They» V=«elected» Od=«her» Co=«president»");
        }

        @ParameterizedTest(name = "corrige: {0}")
        @MethodSource("com.dmc00.fonetica.grammar.GrammarTest#correccionesDelModelo")
        void correccion(String sentence, String pattern, String expected) {
            ClauseAnalysis clause = analyze(sentence).clauses().getFirst();
            assertThat(clause.getPattern()).isEqualTo(pattern);
            assertThat(elements(clause)).isEqualTo(expected);
        }
    }

    @Nested
    @DisplayName("casos especiales")
    class CasosEspeciales {

        @Test
        @DisplayName("existencial: there = sujeto vacío, sujeto nocional y el lugar como adverbial")
        void existencial() {
            ClauseAnalysis clause = analyze("There is a cat on the roof.").clauses().getFirst();
            assertThat(clause.getPattern()).isEqualTo("existencial");
            assertThat(elements(clause)).isEqualTo("S=«There» V=«is» S=«a cat» A*=«on the roof»");
        }

        @Test
        @DisplayName("paráfrasis preposicional del objeto indirecto, con aclaración")
        void parafrasisPreposicional() {
            ClauseAnalysis clause = analyze("I gave the book to my brother.").clauses().getFirst();
            ClauseElement to = clause.getElements().stream()
                    .filter(e -> e.getText().equals("to my brother")).findFirst().orElseThrow();
            assertThat(to.getRole()).isEqualTo("A");
            assertThat(to.getNote()).contains("objeto indirecto");
        }

        @Test
        @DisplayName("pasiva: el agente es adverbial opcional")
        void pasiva() {
            SentenceGrammar sentence = analyze("The letter was written by a famous poet.");
            ClauseAnalysis clause = sentence.clauses().getFirst();
            assertThat(clause.getPattern()).isEqualTo("SV");
            assertThat(clause.getPatternNote()).contains("pasiva");
            assertThat(sentence.verbPhrases().getFirst().label()).isEqualTo("past simple passive");
        }

        @Test
        @DisplayName("imperativa con sujeto implícito")
        void imperativa() {
            SentenceGrammar sentence = analyze("Close the door!");
            assertThat(sentence.form()).isEqualTo("imperativa");
            assertThat(sentence.clauses().getFirst().getPattern()).isEqualTo("SVO");
        }

        @Test
        @DisplayName("pregunta con el verbo partido (Have … been)")
        void verboPartido() {
            SentenceGrammar sentence = analyze("Have you ever been to London?");
            assertThat(sentence.form()).isEqualTo("interrogativa");
            ClauseElement verb = element(sentence.clauses().getFirst(), "V");
            assertThat(verb.getText()).isEqualTo("Have … been");
            assertThat(verb.getPieces()).hasSize(2);
            assertThat(sentence.verbPhrases().getFirst().label()).isEqualTo("present perfect");
        }

        @Test
        @DisplayName("verbo frasal: la partícula es parte del verbo")
        void verboFrasal() {
            ClauseAnalysis clause = analyze("He gave up smoking last year.").clauses().getFirst();
            assertThat(elements(clause)).isEqualTo("S=«He» V=«gave up» Od=«smoking» A=«last year»");
        }
    }

    @Nested
    @DisplayName("oraciones compuestas y complejas")
    class CompuestasYComplejas {

        @Test
        @DisplayName("cláusula nominal finita como objeto")
        void nominalComoObjeto() {
            SentenceGrammar sentence = analyze("I think that she has left.");
            assertThat(sentence.structure()).isEqualTo("compleja");
            ClauseElement object = element(sentence.clauses().getFirst(), "Od");
            assertThat(object.getForm()).isEqualTo("clause");
            assertThat(object.getClause().getLabel()).isEqualTo("cláusula nominal finita introducida por «that»");
        }

        @Test
        @DisplayName("relativa dentro del sujeto (posmodificador del NP)")
        void relativaEnElSujeto() {
            SentenceGrammar sentence = analyze("The man who lives next door is a doctor.");
            ClauseElement subject = element(sentence.clauses().getFirst(), "S");
            ClauseAnalysis relative = subject.getStructure().stream()
                    .filter(p -> p.role().equals("posmodificador")).findFirst().orElseThrow().clause();
            assertThat(relative.getKind()).isEqualTo("relativa");
            assertThat(relative.getLabel()).contains("«who»");
            assertThat(subject.getStructure().stream().filter(p -> p.role().equals("núcleo")).map(StructurePart::text))
                    .containsExactly("man");
        }

        @Test
        @DisplayName("adverbial introducida por \"when\" (el subordinante no es un elemento)")
        void adverbialConWhen() {
            ClauseAnalysis clause = analyze("When it rains, we stay at home.").clauses().getFirst();
            ClauseElement adverbial = clause.getElements().getFirst();
            assertThat(adverbial.getClause().getLabel()).isEqualTo("cláusula adverbial finita introducida por «when»");
            assertThat(elements(adverbial.getClause())).isEqualTo("S=«it» V=«rains»");
            assertThat(clause.getPattern()).isEqualTo("SVA");
        }

        @Test
        @DisplayName("compuesta-compleja: coordinada con \"and\" y una no finita")
        void compuestaCompleja() {
            SentenceGrammar sentence = analyze("She wants to learn French and he plays the piano.");
            assertThat(sentence.structure()).isEqualTo("compuesta-compleja");
            assertThat(sentence.clauses()).hasSize(2);
            assertThat(sentence.clauses().get(0).getText()).isEqualTo("She wants to learn French");
            assertThat(sentence.clauses().get(1).getCoordinator()).isEqualTo("and");
            assertThat(sentence.clauses().get(0).getElements().get(2).getClause().getVerbPhrase().nonFiniteForm())
                    .isEqualTo("to-infinitive");
        }

        @Test
        @DisplayName("coordinada con sujeto elíptico")
        void sujetoEliptico() {
            SentenceGrammar sentence = analyze("She sang and danced.");
            assertThat(sentence.structure()).isEqualTo("compuesta");
            assertThat(sentence.clauses().get(0).getText()).isEqualTo("She sang");
            assertThat(sentence.clauses().get(1).getPatternNote()).contains("elíptico");
        }
    }

    @Nested
    @DisplayName("sujeto ausente o fuera de lugar")
    class SujetoAusente {

        @ParameterizedTest(name = "{1}: {0}")
        @MethodSource("com.dmc00.fonetica.grammar.GrammarTest#sujetoAusenteOFueraDeLugar")
        void caso(String sentence, String pattern, String expected) {
            ClauseAnalysis clause = analyze(sentence).clauses().getFirst();
            assertThat(clause.getPattern()).isEqualTo(pattern);
            assertThat(elements(clause)).isEqualTo(expected);
        }

        @Test
        @DisplayName("las imperativas (también con «don't») se reconocen como tales")
        void imperativas() {
            for (String sentence : List.of("Put the milk in the fridge.", "Be quiet!", "Don't leave the door open.")) {
                SentenceGrammar result = analyze(sentence);
                assertThat(result.form()).as(sentence).isEqualTo("imperativa");
                assertThat(result.clauses().getFirst().getPatternNote()).as(sentence).contains("implícito");
            }
        }

        @Test
        @DisplayName("\"never\" es un adverbial, no parte del grupo verbal, y la inversión es finita")
        void never() {
            VerbPhraseAnalysis vp = analyze("Never have I seen such a mess.").verbPhrases().getFirst();
            assertThat(vp.label()).isEqualTo("present perfect");
            assertThat(vp.finite()).isTrue();
        }

        @Test
        @DisplayName("coordinada con sujeto elíptico")
        void coordinadaElipitica() {
            List<ClauseAnalysis> clauses = analyze("She closed the window and turned off the lights.").clauses();
            assertThat(elements(clauses.get(1))).isEqualTo("V=«turned off» Od=«the lights»");
            assertThat(clauses.get(1).getPatternNote()).contains("elíptico");
        }
    }

    @Nested
    @DisplayName("grupo verbal")
    class GrupoVerbal {

        @Test
        @DisplayName("modal + perfect passive")
        void modalPerfectPassive() {
            VerbPhraseAnalysis vp = analyze("The book might have been stolen.").verbPhrases().getFirst();
            assertThat(vp.label()).isEqualTo("modal «might» + perfect passive");
            assertThat(vp.parts()).extracting(VerbPart::role)
                    .containsExactly("modal", "auxiliar de perfecto", "auxiliar de pasiva", "verbo léxico");
        }

        @Test
        @DisplayName("pasado progresivo")
        void pasadoProgresivo() {
            VerbPhraseAnalysis vp = analyze("The children were sleeping.").verbPhrases().getFirst();
            assertThat(vp.label()).isEqualTo("past progressive");
            assertThat(vp.description()).containsPattern("pasado.*progresivo.*activa");
        }
    }

    /** Las respuestas de los ejercicios (escritas a mano) que no coinciden con el análisis automático. */
    static List<String> exerciseDifferences(java.util.function.Function<String, List<ParsedToken>> parser) {
        List<String> differences = new ArrayList<>();
        for (JsonNode exercise : TestFiles.resourceJson("study-data.json").get("grammarExercises")) {
            String text = exercise.get("sentence").asString();
            SentenceGrammar sentence = QuirkAnalysis.analyzeGrammar(parser.apply(text)).sentences().getFirst();
            boolean elliptic = exercise.get("subject").asString().equals("elíptico");
            ClauseAnalysis clause = sentence.clauses().size() > (elliptic ? 1 : 0)
                    ? sentence.clauses().get(elliptic ? 1 : 0)
                    : null;
            // En el ejercicio el verbo partido de las preguntas son dos piezas; en el análisis, un solo V.
            List<String> roles = new ArrayList<>();
            boolean verbSeen = false;
            for (JsonNode role : exercise.get("roles")) {
                if (role.asString().equals("V")) {
                    if (verbSeen) continue;
                    verbSeen = true;
                }
                roles.add(role.asString());
            }
            String key = String.join(" ", roles);
            String auto = clause == null ? null
                    : clause.getElements().stream().map(ClauseElement::getRole).collect(Collectors.joining(" "));
            String pattern = clause == null ? null : clause.getPattern();
            if (!exercise.get("pattern").asString().equals(pattern) || !key.equals(auto)) {
                differences.add(text + ": " + exercise.get("pattern").asString() + " " + key + " ≠ " + pattern + " " + auto);
            }
        }
        return differences;
    }

    @Test
    @DisplayName("ejercicios con el análisis guardado de spaCy: coincide con las respuestas de los 38")
    void ejerciciosConElFixture() {
        assertThat(TestFiles.resourceJson("study-data.json").get("grammarExercises")).hasSize(38);
        assertThat(exerciseDifferences(GrammarTest::parsed)).isEmpty();
    }

    @Nested
    @DisplayName("analizador spaCy real")
    class AnalizadorReal {

        private static NlpClient client;

        private static NlpClient client() {
            if (client == null) client = NlpClient.locate(TestFiles.resources(), TestFiles.project(), TestFiles.JSON);
            return client;
        }

        @AfterAll
        static void close() {
            if (client != null) client.close();
        }

        @Test
        @DisplayName("responde con el árbol de dependencias")
        void responde() throws Exception {
            assumeTrue(client() != null, "el analizador spaCy no está instalado (npm run build:nlp)");
            assertThat(client().parse("She reads novels.")).extracting(ParsedToken::dep)
                    .containsExactly("nsubj", "ROOT", "dobj", "punct");
        }

        // Las respuestas de los ejercicios están escritas a mano; el analizador tiene que coincidir.
        @Test
        @DisplayName("coincide con las respuestas de los ejercicios")
        void ejercicios() {
            assumeTrue(client() != null, "el analizador spaCy no está instalado (npm run build:nlp)");
            assertThat(exerciseDifferences(text -> {
                try {
                    return client().parse(text);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            })).isEmpty();
        }

        @Test
        @DisplayName("el fixture es lo que devuelve spaCy hoy")
        void fixtureAlDia() throws Exception {
            assumeTrue(client() != null, "el analizador spaCy no está instalado (npm run build:nlp)");
            for (String sentence : List.of("She reads novels.", "Don't leave the door open.", "He put his keys in his pocket.")) {
                assertThat(client().parse(sentence)).as(sentence).isEqualTo(parsed(sentence));
            }
            assertThat(Objects.requireNonNull(PARSES).size()).isEqualTo(58);
        }
    }
}
