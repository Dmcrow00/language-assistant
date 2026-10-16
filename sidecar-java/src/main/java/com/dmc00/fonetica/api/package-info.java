/**
 * El contrato JSON entre la interfaz y el motor: la misma forma que {@code shared/fonetica-api.ts}.
 *
 * <p>Electron reenvía estas estructuras tal cual al renderer Angular, así que los nombres de campo y los
 * valores de texto ({@code "ldoce"}, {@code "britfone"}, {@code "exact"}...) no se cambian. Los campos
 * opcionales del contrato son {@code null} en Java y no se escriben en el JSON; los que el contrato
 * declara como "texto o null" llevan {@code @JsonInclude(ALWAYS)}.
 */
package com.dmc00.fonetica.api;
