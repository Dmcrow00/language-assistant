package com.dmc00.fonetica.grammar;

import com.dmc00.fonetica.grammar.GrammarModel.StructurePart;
import com.dmc00.fonetica.grammar.GrammarModel.TokenSpan;
import java.util.List;

/**
 * Un elemento de la cláusula (S, V, Od, Oi, Cs, Co, A). Es mutable porque el análisis corrige el rol
 * (sujeto invertido, pasiva) y marca los adverbiales obligatorios después de armarlo.
 */
public class ClauseElement {

    private String role;
    private final TokenSpan span;
    private final List<TokenSpan> pieces;
    private final String text;
    private final String form;
    private final String formLabel;
    private Boolean obligatory;
    private String note;
    private final List<StructurePart> structure;
    private final ClauseAnalysis clause;

    /**
     * @param span      desde el primer hasta el último token del elemento
     * @param pieces    sólo si el elemento está partido (el verbo en «Have you ever been…?»); opcional
     * @param form      NP, VP, AdjP, AdvP, PP, clause u other
     * @param formLabel p. ej. "frase nominal (NP)" o "cláusula nominal finita"
     * @param note      aclaración para el alumno (sujeto vacío "there", agente de la pasiva...); opcional
     * @param structure estructura interna de la frase; opcional
     * @param clause    si el elemento es una cláusula, su análisis; opcional
     */
    public ClauseElement(String role, TokenSpan span, List<TokenSpan> pieces, String text, String form,
                         String formLabel, String note, List<StructurePart> structure, ClauseAnalysis clause) {
        this.role = role;
        this.span = span;
        this.pieces = pieces;
        this.text = text;
        this.form = form;
        this.formLabel = formLabel;
        this.note = note;
        this.structure = structure;
        this.clause = clause;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public TokenSpan getSpan() {
        return span;
    }

    public List<TokenSpan> getPieces() {
        return pieces;
    }

    public String getText() {
        return text;
    }

    public String getForm() {
        return form;
    }

    public String getFormLabel() {
        return formLabel;
    }

    /** Sólo adverbiales: obligatorio en el patrón (SVA, SVOA) u opcional; null mientras no se decidió. */
    public Boolean getObligatory() {
        return obligatory;
    }

    public void setObligatory(Boolean obligatory) {
        this.obligatory = obligatory;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public List<StructurePart> getStructure() {
        return structure;
    }

    public ClauseAnalysis getClause() {
        return clause;
    }
}
