package com.dmc00.fonetica.api;

import java.util.List;

/** Las pronunciaciones de una palabra en el diccionario local y de dónde salen ("ldoce" o "britfone"). */
public record Prons(List<String> prons, String source) {
}
