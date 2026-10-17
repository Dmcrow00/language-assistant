package com.dmc00.fonetica.api;

/**
 * Una de las formas que Longman separa con etiquetas. En las function words la primera (sin etiqueta)
 * es la débil: the /ðə; before vowels ði; strong ðiː/.
 *
 * @param label etiqueta tal como la escribe Longman ("strong", "before vowels"...); {@code null} = la habitual
 */
public record LdocePronForm(String label, String pron) {
}
