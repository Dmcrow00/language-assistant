package com.dmc00.fonetica.api;

import java.util.List;

/**
 * Una consulta a Longman.
 *
 * @param status      "found", "suggestions" ("Did you mean...?"), "not-found" u "offline"
 * @param suggestions sugerencias de Longman cuando la palabra no existe
 * @param fetchedAt   fecha ISO-8601 de la consulta (UTC, con milisegundos)
 * @param message     detalle del error cuando status = offline
 */
public record LdoceLookup(
        String query,
        String status,
        List<LdoceEntry> entries,
        List<String> suggestions,
        String pageUrl,
        String fetchedAt,
        boolean fromCache,
        String message) {

    public LdoceLookup withFromCache(boolean value) {
        return new LdoceLookup(query, status, entries, suggestions, pageUrl, fetchedAt, value, message);
    }
}
