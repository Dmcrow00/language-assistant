import { existsSync, readFileSync } from 'node:fs';
import type { InferenceSession } from 'onnxruntime-node';

/**
 * Voz de Piper ejecutada dentro de la app con ONNX Runtime: sin servicios externos y sin conexión.
 *
 * Piper recibe fonemas (no texto): cada símbolo IPA tiene un número en el `phoneme_id_map` del
 * .onnx.json. Así la voz pronuncia exactamente la transcripción que muestra la app, con las
 * formas débiles o fuertes elegidas. La secuencia que espera el modelo es
 *   ^ _ f1 _ f2 _ … fn _ $        (inicio, separadores "_" entre fonemas, fin)
 */

interface PiperConfig {
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  phoneme_id_map: Record<string, number[]>;
}

export interface SynthesisOptions {
  /** Más de 1 habla más despacio (1,45 para el modo lento) sin cambiar el tono. */
  lengthScale?: number;
}

export class PiperVoice {
  private readonly config: PiperConfig;
  private session: Promise<InferenceSession> | null = null;

  constructor(private readonly modelPath: string) {
    this.config = JSON.parse(readFileSync(`${modelPath}.json`, 'utf8')) as PiperConfig;
  }

  /** La voz se baja aparte (npm run fetch-voice): si no está, la app funciona sin ella. */
  static isInstalled(modelPath: string): boolean {
    return existsSync(modelPath) && existsSync(`${modelPath}.json`);
  }

  /** Devuelve un WAV (16 bits, mono). La primera vez carga el modelo, que tarda un par de segundos. */
  async synthesize(phonemes: string, options: SynthesisOptions = {}): Promise<Uint8Array> {
    // onnxruntime-node es un módulo nativo: se carga recién cuando se usa la voz.
    const ort = await import('onnxruntime-node');
    this.session ??= ort.InferenceSession.create(this.modelPath, { executionProviders: ['cpu'] });
    const session = await this.session;

    const ids = phonemesToIds(phonemes, this.config.phoneme_id_map);
    const { noise_scale, length_scale, noise_w } = this.config.inference;
    const result = await session.run({
      input: new ort.Tensor(
        'int64',
        BigInt64Array.from(ids, (id) => BigInt(id)),
        [1, ids.length],
      ),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor(
        'float32',
        Float32Array.from([noise_scale, options.lengthScale ?? length_scale, noise_w]),
        [3],
      ),
    });
    const samples = result[session.outputNames[0]].data as Float32Array;
    return encodeWav(samples, this.config.audio.sample_rate);
  }
}

/** Fonemas (cadena IPA en notación eSpeak) → números del modelo. Los símbolos desconocidos se omiten. */
export function phonemesToIds(phonemes: string, map: Record<string, number[]>): number[] {
  const pad = map['_'];
  const ids = [...map['^'], ...pad];
  for (const symbol of phonemes.normalize('NFD')) {
    const id = map[symbol];
    if (id) ids.push(...id, ...pad);
  }
  ids.push(...map['$']);
  return ids;
}

/** Muestras en coma flotante → WAV PCM de 16 bits, normalizado al volumen máximo como hace Piper. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  let peak = 0.01;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = 32767 / peak;
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // tamaño del bloque fmt
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // bytes por segundo
  buffer.writeUInt16LE(2, 32); // bytes por muestra
  buffer.writeUInt16LE(16, 34); // bits por muestra
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  samples.forEach((s, i) =>
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * scale))), 44 + i * 2),
  );
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
