package com.dmc00.fonetica.api;

/** Cuántas palabras tiene el diccionario local y cuántas ya usan la transcripción de Longman. */
public record LexiconInfo(int total, int fromLdoce) {
}
