package com.dmc00.fonetica.api;

/**
 * Un proceso del habla conectada entre una palabra y la siguiente. Todos son optativos en RP.
 *
 * @param kind      "linking-r", "intrusive-r", "elision", "assimilation" o "coalescence"
 * @param wordIndex palabra en la que empieza el proceso (la siguiente también puede cambiar)
 * @param label     nombre del proceso en castellano
 * @param detail    qué cambia: "/t/ → /k/ ante /k/"
 * @param words     las dos palabras: "that cat"
 */
public record ConnectedProcess(String kind, int wordIndex, String label, String detail, String words) {
}
