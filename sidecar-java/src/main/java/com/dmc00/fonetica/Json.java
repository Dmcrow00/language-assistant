package com.dmc00.fonetica;

import com.fasterxml.jackson.annotation.JsonInclude;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** El {@link ObjectMapper} del motor: una sola configuración para el protocolo, la caché y los tests. */
public final class Json {

    private Json() {
    }

    public static ObjectMapper mapper() {
        return JsonMapper.builder()
                // Los campos opcionales del contrato no se escriben cuando faltan, como hace JSON.stringify.
                .changeDefaultPropertyInclusion(inclusion -> inclusion.withValueInclusion(JsonInclude.Include.NON_NULL))
                // El orden de los campos es el de la declaración (Jackson 3 los ordena alfabéticamente por defecto).
                .disable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
                // La caché puede tener campos de versiones viejas.
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .build();
    }
}
