package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Una entrada de Longman tal como aparece en la página de la palabra. Todos los campos salvo
 * {@code headword} son opcionales.
 *
 * @param pronBrE      pronunciación británica (RP); sonidos opcionales entre paréntesis
 * @param pronFormsBrE sólo si Longman da más de una forma etiquetada (débil / fuerte / ante vocal)
 * @param pronAmE      variante americana, si Longman la indica (en la página aparece después de "$")
 */
public record LdoceEntry(
        String headword,
        String homnum,
        String pos,
        String pronBrE,
        List<LdocePronForm> pronFormsBrE,
        String pronAmE,
        String audioBrE,
        String audioAmE,
        String definition) {
}
