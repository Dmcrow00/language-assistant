// Arma el analizador gramatical (spaCy) como ejecutable independiente en resources/nlp/nlp-server/,
// para que los alumnos no necesiten tener Python instalado.
//
//   npm run build:nlp            lo arma si falta o si cambió nlp/nlp_server.py
//   npm run build:nlp -- --force lo rearma siempre
//
// Requiere Python 3.12 en el PATH. La primera vez crea el entorno nlp/.venv e instala las
// versiones fijadas en nlp/requirements.lock.txt (spaCy, el modelo en_core_web_sm y PyInstaller).
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const venv = join(root, 'nlp', '.venv');
const python = join(venv, 'Scripts', 'python.exe');
const server = join(root, 'nlp', 'nlp_server.py');
const lock = join(root, 'nlp', 'requirements.lock.txt');
const output = join(root, 'resources', 'nlp', 'nlp-server', 'nlp-server.exe');
const force = process.argv.includes('--force');

const run = (file, args) => execFileSync(file, args, { cwd: root, stdio: 'inherit' });
const newer = (a, b) => statSync(a).mtimeMs > statSync(b).mtimeMs;

if (!force && existsSync(output) && newer(output, server) && newer(output, lock)) {
  console.log('ok (ya estaba)  resources/nlp/nlp-server');
  process.exit(0);
}

if (!existsSync(python)) {
  console.log('Creando el entorno de Python en nlp/.venv…');
  run('python', ['-m', 'venv', venv]);
  run(python, ['-m', 'pip', 'install', '--no-cache-dir', '-r', lock]);
}

console.log('Empaquetando el analizador con PyInstaller…');
run(python, [
  '-m',
  'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onedir',
  '--name',
  'nlp-server',
  '--distpath',
  join(root, 'resources', 'nlp'),
  '--workpath',
  join(root, 'nlp', 'build'),
  '--specpath',
  join(root, 'nlp', 'build'),
  '--collect-all',
  'en_core_web_sm',
  '--exclude-module',
  'tkinter',
  server,
]);
console.log('ok  resources/nlp/nlp-server');
