package com.dmc00.fonetica.grammar;

import java.util.List;

/**
 * Tipos del análisis gramatical según Quirk / Greenbaum (A Student's Grammar of the English Language):
 * la misma forma JSON que {@code shared/grammar.ts}, que es lo que dibuja la interfaz.
 *
 * <p>Valores de texto que se usan: elementos de la cláusula {@code S V Od Oi Cs Co A}; formas de frase
 * {@code NP VP AdjP AdvP PP clause other}; tipos de cláusula {@code independiente coordinada nominal
 * adverbial relativa "posmodificadora no finita"}.
 */
public final class GrammarModel {

    private GrammarModel() {
    }

    /** Rango de tokens [start, end). */
    public record TokenSpan(int start, int end) {
    }

    /**
     * @param ws        espacio que sigue al token en el texto original
     * @param wordClass clase de palabra según Quirk, en castellano
     */
    public record GrammarToken(String text, String ws, String lemma, String pos, String tag, String wordClass) {
    }

    /**
     * Estructura interna de una frase: NP (det + premod + núcleo + posmod), PP (prep + complemento)...
     *
     * @param role   determinante, premodificador, núcleo, posmodificador, preposición o complemento preposicional
     * @param clause si la parte es una cláusula (relativa, no finita...), su análisis; opcional
     */
    public record StructurePart(String role, TokenSpan span, String text, ClauseAnalysis clause) {
    }

    /** Una pieza del grupo verbal: "modal", "auxiliar de perfecto", "verbo léxico", "partícula"... */
    public record VerbPart(String text, String role) {
    }

    /**
     * El grupo verbal.
     *
     * @param nonFiniteForm sólo no finitos: to-infinitive, bare infinitive, -ing participle, -ed participle
     * @param tense         present o past (sólo finitos sin modal)
     * @param label         en inglés, como se nombra en clase: "present perfect progressive passive"
     * @param description   explicación en castellano
     */
    public record VerbPhraseAnalysis(
            TokenSpan span,
            String text,
            List<VerbPart> parts,
            boolean finite,
            String nonFiniteForm,
            String tense,
            String modal,
            boolean perfect,
            boolean progressive,
            boolean passive,
            boolean negative,
            boolean imperative,
            String label,
            String description) {
    }

    /**
     * Una oración.
     *
     * @param structure simple, compuesta, compleja o compuesta-compleja
     * @param form      declarativa, interrogativa, imperativa o exclamativa
     * @param clauses   las cláusulas independientes (más de una si la oración es compuesta)
     */
    public record SentenceGrammar(
            TokenSpan span,
            String text,
            String structure,
            String form,
            List<ClauseAnalysis> clauses,
            List<VerbPhraseAnalysis> verbPhrases,
            int subordinateClauses) {
    }

    public record GrammarAnalysis(List<GrammarToken> tokens, List<SentenceGrammar> sentences) {
    }
}
