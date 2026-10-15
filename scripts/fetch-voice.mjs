// Descarga la voz británica de Piper ("Cori", alta calidad) en resources/piper/ y verifica su MD5.
// El modelo pesa 114 MB: no va al repositorio, se baja con `npm run fetch-voice`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high';
// Valores publicados en voices.json del repositorio rhasspy/piper-voices.
const FILES = [
  { name: 'en_GB-cori-high.onnx', md5: '3474a80133d9a03e6870d2ac42c18806' },
  { name: 'en_GB-cori-high.onnx.json', md5: '0f7d42e77a99193006aa34a34442f5e0' },
  { name: 'MODEL_CARD', md5: '12db31ecedf1d6458a215d3012339a20' },
];

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'piper');
mkdirSync(target, { recursive: true });

const md5 = (bytes) => createHash('md5').update(bytes).digest('hex');

for (const file of FILES) {
  const path = join(target, file.name);
  if (existsSync(path) && md5(readFileSync(path)) === file.md5) {
    console.log(`ok (ya estaba)  ${file.name}`);
    continue;
  }
  process.stdout.write(`bajando        ${file.name}… `);
  const response = await fetch(`${BASE}/${file.name}`);
  if (!response.ok) throw new Error(`${file.name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (md5(bytes) !== file.md5) throw new Error(`${file.name}: el MD5 no coincide, no se guarda`);
  writeFileSync(path, bytes);
  console.log(`ok (${(bytes.length / 1e6).toFixed(1)} MB)`);
}
