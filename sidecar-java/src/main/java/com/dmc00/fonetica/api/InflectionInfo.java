package com.dmc00.fonetica.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/** Las formas -s y -ed de un verbo; todo {@code null} si el verbo no está en el diccionario. */
public record InflectionInfo(
        String base,
        @JsonInclude(Include.ALWAYS) String basePron,
        @JsonInclude(Include.ALWAYS) InflectedForm s,
        @JsonInclude(Include.ALWAYS) InflectedForm ed) {
}
