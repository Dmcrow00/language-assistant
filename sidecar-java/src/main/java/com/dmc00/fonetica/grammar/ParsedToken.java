package com.dmc00.fonetica.grammar;

/**
 * Un token tal como lo devuelve spaCy ({@code nlp/nlp_server.py}).
 *
 * @param ws        espacio que sigue al token en el texto original
 * @param pos       clase de palabra universal (NOUN, VERB...)
 * @param tag       etiqueta detallada de Penn Treebank (NNS, VBD...)
 * @param dep       relación con su núcleo (nsubj, dobj, prep...)
 * @param head      índice del núcleo; el ROOT se apunta a sí mismo
 * @param sentStart el token empieza una oración
 */
public record ParsedToken(
        int i,
        String text,
        String ws,
        int idx,
        String lemma,
        String pos,
        String tag,
        String dep,
        int head,
        String morph,
        boolean sentStart) {
}
