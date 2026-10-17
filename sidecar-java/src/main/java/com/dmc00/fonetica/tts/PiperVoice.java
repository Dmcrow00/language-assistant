package com.dmc00.fonetica.tts;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Voz de Piper ejecutada dentro de la app con ONNX Runtime: sin servicios externos y sin conexión.
 *
 * <p>Piper recibe fonemas (no texto): cada símbolo IPA tiene un número en el {@code phoneme_id_map} del
 * .onnx.json. Así la voz pronuncia exactamente la transcripción que muestra la app, con las formas débiles
 * o fuertes elegidas. La secuencia que espera el modelo es
 * <pre>  ^ _ f1 _ f2 _ … fn _ $        (inicio, separadores "_" entre fonemas, fin)</pre>
 */
public class PiperVoice implements AutoCloseable {

    private final Path modelPath;
    private final int sampleRate;
    private final float noiseScale;
    private final float lengthScale;
    private final float noiseW;
    private final Map<String, List<Integer>> phonemeIdMap;
    private OrtSession session;

    public PiperVoice(Path modelPath, ObjectMapper json) throws IOException {
        this.modelPath = modelPath;
        JsonNode config = json.readTree(Files.readString(configOf(modelPath), StandardCharsets.UTF_8));
        this.sampleRate = config.path("audio").path("sample_rate").asInt();
        JsonNode inference = config.path("inference");
        this.noiseScale = (float) inference.path("noise_scale").asDouble();
        this.lengthScale = (float) inference.path("length_scale").asDouble();
        this.noiseW = (float) inference.path("noise_w").asDouble();
        this.phonemeIdMap = new HashMap<>();
        for (Map.Entry<String, JsonNode> entry : config.path("phoneme_id_map").properties()) {
            List<Integer> ids = new ArrayList<>();
            entry.getValue().forEach(id -> ids.add(id.asInt()));
            phonemeIdMap.put(entry.getKey(), ids);
        }
    }

    /** La voz se baja aparte (npm run fetch-voice): si no está, la app funciona sin ella. */
    public static boolean isInstalled(Path modelPath) {
        return Files.exists(modelPath) && Files.exists(configOf(modelPath));
    }

    private static Path configOf(Path modelPath) {
        return modelPath.resolveSibling(modelPath.getFileName() + ".json");
    }

    /**
     * Devuelve un WAV (16 bits, mono). La primera vez carga el modelo, que tarda un par de segundos.
     *
     * @param lengthScale más de 1 habla más despacio (1,45 para el modo lento) sin cambiar el tono; null = el del modelo
     */
    public byte[] synthesize(String phonemes, Float lengthScale) throws OrtException {
        OrtSession model = session();
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        long[] ids = phonemesToIds(phonemes, phonemeIdMap).stream().mapToLong(Integer::longValue).toArray();
        float[] scales = {noiseScale, lengthScale != null ? lengthScale : this.lengthScale, noiseW};
        try (OnnxTensor input = OnnxTensor.createTensor(env, new long[][] {ids});
             OnnxTensor inputLengths = OnnxTensor.createTensor(env, new long[] {ids.length});
             OnnxTensor scalesTensor = OnnxTensor.createTensor(env, scales);
             OrtSession.Result result = model.run(Map.of(
                     "input", input,
                     "input_lengths", inputLengths,
                     "scales", scalesTensor))) {
            FloatBuffer output = ((OnnxTensor) result.get(0)).getFloatBuffer();
            float[] samples = new float[output.remaining()];
            output.get(samples);
            return encodeWav(samples, sampleRate);
        }
    }

    /** ONNX Runtime es nativo y pesado: se carga recién cuando se usa la voz. */
    private synchronized OrtSession session() throws OrtException {
        if (session == null) {
            try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
                session = OrtEnvironment.getEnvironment().createSession(modelPath.toString(), options);
            }
        }
        return session;
    }

    @Override
    public synchronized void close() throws OrtException {
        if (session != null) session.close();
        session = null;
    }

    /** Fonemas (cadena IPA en notación eSpeak) → números del modelo. Los símbolos desconocidos se omiten. */
    public static List<Integer> phonemesToIds(String phonemes, Map<String, List<Integer>> map) {
        List<Integer> pad = map.get("_");
        List<Integer> ids = new ArrayList<>(map.get("^"));
        ids.addAll(pad);
        Normalizer.normalize(phonemes, Normalizer.Form.NFD).codePoints().forEach(codePoint -> {
            List<Integer> id = map.get(Character.toString(codePoint));
            if (id != null) {
                ids.addAll(id);
                ids.addAll(pad);
            }
        });
        ids.addAll(map.get("$"));
        return ids;
    }

    /** Muestras en coma flotante → WAV PCM de 16 bits, normalizado al volumen máximo como hace Piper. */
    public static byte[] encodeWav(float[] samples, int sampleRate) {
        double peak = 0.01;
        for (float s : samples) peak = Math.max(peak, Math.abs((double) s));
        double scale = 32767 / peak;
        int dataBytes = samples.length * 2;
        ByteBuffer buffer = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN);
        buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(36 + dataBytes);
        buffer.put("WAVE".getBytes(StandardCharsets.US_ASCII));
        buffer.put("fmt ".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(16); // tamaño del bloque fmt
        buffer.putShort((short) 1); // PCM
        buffer.putShort((short) 1); // mono
        buffer.putInt(sampleRate);
        buffer.putInt(sampleRate * 2); // bytes por segundo
        buffer.putShort((short) 2); // bytes por muestra
        buffer.putShort((short) 16); // bits por muestra
        buffer.put("data".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(dataBytes);
        for (float s : samples) {
            long value = Math.max(-32768, Math.min(32767, Math.round(s * scale)));
            buffer.putShort((short) value);
        }
        return buffer.array();
    }
}
