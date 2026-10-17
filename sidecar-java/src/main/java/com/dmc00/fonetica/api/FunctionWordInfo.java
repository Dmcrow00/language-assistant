package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Información de una function word (artículos, preposiciones, auxiliares, pronombres...) dentro de la
 * oración. Es mutable porque la razón se completa en el segundo paso del análisis (forma ante vocal).
 */
public class FunctionWordInfo {

    private final String category;
    private final String form;
    private final List<String> weak;
    private final String weakBeforeVowel;
    private final String strong;
    private String reason;
    private final boolean forced;
    private final String ambiguous;
    private final boolean fromLongman;

    /**
     * @param form            "weak" o "strong"
     * @param weak            formas débiles; la primera es la habitual ante consonante
     * @param weakBeforeVowel forma débil ante vocal, si es distinta (the → ði, to → tʊ); opcional
     * @param reason          por qué se eligió esa forma, para mostrarle al alumno
     * @param forced          la forma la eligió el alumno (enfatizada → fuerte, sin énfasis → débil)
     * @param ambiguous       aviso cuando la forma depende del sentido (that demostrativo o conjunción...); opcional
     * @param fromLongman     true si las formas salen de Longman; false si salen de la tabla de Roach
     */
    public FunctionWordInfo(String category, String form, List<String> weak, String weakBeforeVowel, String strong,
                            String reason, boolean forced, String ambiguous, boolean fromLongman) {
        this.category = category;
        this.form = form;
        this.weak = weak;
        this.weakBeforeVowel = weakBeforeVowel;
        this.strong = strong;
        this.reason = reason;
        this.forced = forced;
        this.ambiguous = ambiguous;
        this.fromLongman = fromLongman;
    }

    public String getCategory() {
        return category;
    }

    public String getForm() {
        return form;
    }

    public List<String> getWeak() {
        return weak;
    }

    public String getWeakBeforeVowel() {
        return weakBeforeVowel;
    }

    public String getStrong() {
        return strong;
    }

    public String getReason() {
        return reason;
    }

    public void appendToReason(String text) {
        reason += text;
    }

    public boolean isForced() {
        return forced;
    }

    public String getAmbiguous() {
        return ambiguous;
    }

    public boolean isFromLongman() {
        return fromLongman;
    }
}
