package com.dmc00.fonetica.api;

import java.util.List;

/**
 * La oración transcripta.
 *
 * @param transcription          la oración completa entre barras, lista para copiar
 * @param processes              procesos posibles del habla conectada
 * @param connectedTranscription la transcripción con esos procesos aplicados
 */
public record SentenceAnalysis(
        List<SentenceWord> words,
        String transcription,
        List<ConnectedProcess> processes,
        String connectedTranscription) {
}
