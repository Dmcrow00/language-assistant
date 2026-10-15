import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PHONEMES } from '../../shared/phoneme-inventory';
import { Lexicon } from '../core/lexicon';
import { analyzeSentence } from '../core/sentence';
import { sentenceToEspeak, wordToEspeak } from '../tts/espeak-notation';
import { encodeWav, phonemesToIds, PiperVoice } from '../tts/piper-voice';

const ROOT = join(__dirname, '..', '..', '..');
const lexicon = new Lexicon();
lexicon.loadBritfone(
  readFileSync(join(ROOT, 'resources', 'britfone', 'britfone.main.3.0.1.csv'), 'utf8'),
);
const MODEL = join(ROOT, 'resources', 'piper', 'en_GB-cori-high.onnx');

describe('notación eSpeak para la voz', () => {
  it('convierte símbolos y corre el acento antes de la vocal', () => {
    assert.equal(wordToEspeak('kəmˈpjuːtə', 'keep'), 'kəmpjˈuːtə');
    assert.equal(wordToEspeak('kæt', 'ensure'), 'kˈat');
    assert.equal(wordToEspeak('hɪə', 'ensure'), 'hˈiə');
    assert.equal(wordToEspeak('ˈred', 'ensure'), 'ɹˈɛd');
    assert.equal(wordToEspeak('ðə', 'none'), 'ðə');
    assert.equal(wordToEspeak('ˈɡʌv(ə)mənt', 'keep'), 'ɡˈʌvəmənt');
  });

  // Calibración contra eSpeak (la notación con la que se entrenó la voz): las palabras de ejemplo
  // de la tabla fonémica tienen que quedar igual que como las escribe eSpeak.
  it('coincide con eSpeak en las palabras de la tabla fonémica', async () => {
    const { phonemize } = require('phonemizer') as {
      phonemize: (t: string, l: string) => Promise<string[]>;
    };
    // Diferencias de diccionario, no de notación: Britfone y eSpeak transcriben distinto estas palabras.
    const known = new Set(['situation', 'television', 'video', 'teacher', 'tourist', 'shall']);
    const mismatches: string[] = [];
    for (const { example } of PHONEMES) {
      if (known.has(example)) continue;
      const pron = lexicon.pronsOf(example)?.prons[0];
      if (!pron) continue;
      const ours = wordToEspeak(pron, 'ensure');
      const espeak = (await phonemize(example, 'en')).join('');
      if (ours !== espeak) mismatches.push(`${example}: ${ours} ≠ ${espeak}`);
    }
    assert.deepEqual(mismatches, []);
  });

  it('la oración lleva las formas elegidas, el acento de las palabras de contenido y la puntuación', () => {
    const text = 'Where are you from?';
    const analysis = analyzeSentence(
      text,
      { connected: true, forcedStrong: [], forcedWeak: [] },
      { pronsOf: (w) => lexicon.pronsOf(w), longmanForms: () => null },
    );
    assert.equal(sentenceToEspeak(text, analysis), 'wˈeəɹ ə juː fɹˈɒm?');
  });
});

describe('entrada y salida del modelo', () => {
  it('arma la secuencia ^ _ f _ f _ $', () => {
    const map = { '^': [1], $: [2], _: [0], k: [23], a: [14], t: [32] };
    assert.deepEqual(phonemesToIds('kat', map), [1, 0, 23, 0, 14, 0, 32, 0, 2]);
  });

  it('genera un WAV de 16 bits normalizado', () => {
    const wav = encodeWav(Float32Array.from([0, 0.5, -0.25]), 22050);
    const view = Buffer.from(wav);
    assert.equal(view.toString('ascii', 0, 4), 'RIFF');
    assert.equal(view.readUInt32LE(24), 22050);
    assert.equal(view.readInt16LE(46), 32767);
    assert.equal(view.length, 44 + 6);
  });

  it(
    'sintetiza una oración con la voz instalada',
    { skip: !PiperVoice.isInstalled(MODEL) },
    async () => {
      const voice = new PiperVoice(MODEL);
      const wav = await voice.synthesize('ðə kˈat sˈat ɒn ðə mˈat.');
      const seconds = (wav.length - 44) / 2 / 22050;
      assert.ok(seconds > 0.8 && seconds < 4, `duración ${seconds.toFixed(2)} s`);
      const slow = await voice.synthesize('ðə kˈat sˈat ɒn ðə mˈat.', { lengthScale: 1.45 });
      assert.ok(slow.length > wav.length * 1.2, 'el modo lento dura más');
    },
  );
});
