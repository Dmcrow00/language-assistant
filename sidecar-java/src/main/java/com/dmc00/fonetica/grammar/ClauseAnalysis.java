package com.dmc00.fonetica.grammar;

import com.dmc00.fonetica.grammar.GrammarModel.TokenSpan;
import com.dmc00.fonetica.grammar.GrammarModel.VerbPhraseAnalysis;
import java.util.List;

/**
 * Una cláusula. Es mutable porque la oración le agrega el coordinante después de analizarla y una
 * posmodificadora finita se reclasifica como nominal apositiva.
 */
public class ClauseAnalysis {

    private String kind;
    private final String finiteness;
    private String label;
    private final TokenSpan span;
    private final String text;
    private final String subordinator;
    private String coordinator;
    private final List<ClauseElement> elements;
    private final String pattern;
    private final String patternNote;
    private final VerbPhraseAnalysis verbPhrase;

    /**
     * @param kind         independiente, coordinada, nominal, adverbial, relativa o posmodificadora no finita
     * @param finiteness   finita o no finita
     * @param label        "cláusula adverbial finita introducida por «when»"
     * @param subordinator opcional
     * @param pattern      uno de los siete tipos de Quirk (SV, SVO, SVC, SVA, SVOO, SVOC, SVOA), "existencial" o "—"
     * @param patternNote  opcional
     * @param verbPhrase   opcional (las cláusulas sin verbo no tienen)
     */
    public ClauseAnalysis(String kind, String finiteness, String label, TokenSpan span, String text,
                          String subordinator, List<ClauseElement> elements, String pattern, String patternNote,
                          VerbPhraseAnalysis verbPhrase) {
        this.kind = kind;
        this.finiteness = finiteness;
        this.label = label;
        this.span = span;
        this.text = text;
        this.subordinator = subordinator;
        this.elements = elements;
        this.pattern = pattern;
        this.patternNote = patternNote;
        this.verbPhrase = verbPhrase;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getFiniteness() {
        return finiteness;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public TokenSpan getSpan() {
        return span;
    }

    public String getText() {
        return text;
    }

    public String getSubordinator() {
        return subordinator;
    }

    /** Coordinante que la une a la anterior (and, but, or); opcional. */
    public String getCoordinator() {
        return coordinator;
    }

    public void setCoordinator(String coordinator) {
        this.coordinator = coordinator;
    }

    public List<ClauseElement> getElements() {
        return elements;
    }

    public String getPattern() {
        return pattern;
    }

    public String getPatternNote() {
        return patternNote;
    }

    public VerbPhraseAnalysis getVerbPhrase() {
        return verbPhrase;
    }
}
