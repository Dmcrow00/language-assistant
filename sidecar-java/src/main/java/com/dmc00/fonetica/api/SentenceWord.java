package com.dmc00.fonetica.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.util.List;

/**
 * Una palabra de la oración ya transcripta. Es mutable porque el análisis la completa en tres pasos:
 * transcripción propia, forma ante vocal / r de enlace y procesos del habla conectada.
 */
public class SentenceWord {

    private final int index;
    private final String text;
    private final int start;
    private final int end;
    private final String key;
    @JsonInclude(Include.ALWAYS)
    private String pron;
    @JsonInclude(Include.ALWAYS)
    private String source;
    private String note;
    private List<String> alternatives = List.of();
    private boolean linkingR;
    private FunctionWordInfo functionWord;
    private final String pauseAfter;
    private String connectedPron;

    /**
     * @param index      posición entre las palabras de la oración (0, 1, 2...)
     * @param text       tal como la escribió el alumno
     * @param start      posición en el texto original
     * @param key        clave para consultar Longman y el diccionario local (minúsculas)
     * @param pauseAfter pausa después de la palabra: "|" menor (coma), "||" mayor (fin de oración); opcional
     */
    public SentenceWord(int index, String text, int start, int end, String key, String pauseAfter) {
        this.index = index;
        this.text = text;
        this.start = start;
        this.end = end;
        this.key = key;
        this.pauseAfter = pauseAfter;
    }

    public int getIndex() {
        return index;
    }

    public String getText() {
        return text;
    }

    public int getStart() {
        return start;
    }

    public int getEnd() {
        return end;
    }

    public String getKey() {
        return key;
    }

    /** Transcripción usada en la oración; {@code null} si no se encontró. */
    public String getPron() {
        return pron;
    }

    public void setPron(String pron) {
        this.pron = pron;
    }

    /** "ldoce", "britfone", "derived" (armada desde otra palabra), "rule" (tabla de function words) o null. */
    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    /** Explicación de la transcripción cuando es derivada. */
    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public List<String> getAlternatives() {
        return alternatives;
    }

    public void setAlternatives(List<String> alternatives) {
        this.alternatives = alternatives;
    }

    /** Se agrega una /r/ de enlace porque la palabra siguiente empieza con vocal (far‿away). */
    public boolean isLinkingR() {
        return linkingR;
    }

    public void setLinkingR(boolean linkingR) {
        this.linkingR = linkingR;
    }

    public FunctionWordInfo getFunctionWord() {
        return functionWord;
    }

    public void setFunctionWord(FunctionWordInfo functionWord) {
        this.functionWord = functionWord;
    }

    public String getPauseAfter() {
        return pauseAfter;
    }

    /** Transcripción con los procesos del habla conectada aplicados (sólo si cambia). */
    public String getConnectedPron() {
        return connectedPron;
    }

    public void setConnectedPron(String connectedPron) {
        this.connectedPron = connectedPron;
    }
}
