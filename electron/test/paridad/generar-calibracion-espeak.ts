/**
 * Guarda cómo escribe eSpeak (paquete phonemizer, variante "en") las palabras de ejemplo de la tabla
 * fonémica. El test de calibración de la notación eSpeak (EspeakNotationTest en Java) compara contra
 * este archivo, así no necesita eSpeak.
 *
 *   npm run build:electron && node dist-electron/electron/test/paridad/generar-calibracion-espeak.js
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHONEMES } from '../../../shared/phoneme-inventory';

async function main(): Promise<void> {
  const { phonemize } = require('phonemizer') as {
    phonemize: (t: string, l: string) => Promise<string[]>;
  };
  const result: Record<string, string> = {};
  for (const { example } of PHONEMES) result[example] = (await phonemize(example, 'en')).join('');
  const out = join(__dirname, '..', '..', '..', '..', 'sidecar-java', 'src', 'test', 'resources', 'espeak-calibracion.json');
  writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`, 'utf8');
  console.log(`ok  ${out}`);
}

void main();
