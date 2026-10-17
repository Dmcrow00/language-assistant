// Arma el motor Java en sidecar-java/target/sidecar/ para que Electron lo use (en desarrollo) y para el
// instalador: el jar, las librerías nativas de ONNX Runtime y el Java mínimo que arma jlink.
//
//   npm run build:sidecar            lo arma si falta o si cambió algo de sidecar-java/
//   npm run build:sidecar -- --force lo rearma siempre
//
// Necesita JDK 25 en JAVA_HOME. Los tests del motor se corren aparte: npm run test:sidecar.
// Al final le hace unos pedidos al motor recién armado con su propio Java, para comprobar que a jlink no
// le faltó ningún módulo (si falta uno, el motor arranca pero no responde).
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { mvnw, sidecarDir } from './mvnw.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(sidecarDir, 'target', 'sidecar');
const jar = join(output, 'fonetica-sidecar.jar');
const java = join(output, 'runtime', 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
const force = process.argv.includes('--force');

// La versión vive en package.json; el pom tiene que decir lo mismo.
const appVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const pomVersion = readFileSync(join(sidecarDir, 'pom.xml'), 'utf8').match(
  /<artifactId>fonetica-sidecar<\/artifactId>\s*<version>([^<]+)<\/version>/,
)?.[1];
if (pomVersion !== appVersion) {
  console.error(
    `La versión de sidecar-java/pom.xml (${pomVersion}) no es la de package.json (${appVersion}).`,
  );
  process.exit(1);
}

const newestSource = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((newest, entry) => {
    const path = join(dir, entry.name);
    return Math.max(newest, entry.isDirectory() ? newestSource(path) : statSync(path).mtimeMs);
  }, 0);
const upToDate =
  existsSync(jar) &&
  existsSync(java) &&
  statSync(jar).mtimeMs >
    Math.max(
      newestSource(join(sidecarDir, 'src', 'main')),
      statSync(join(sidecarDir, 'pom.xml')).mtimeMs,
    );

if (!force && upToDate) {
  console.log('ok (ya estaba)  sidecar-java/target/sidecar');
  process.exit(0);
}

console.log('Armando el motor Java (jar + runtime con jlink)…');
const status = mvnw(['-B', '-ntp', '-q', 'package', '-DskipTests', '-Pempaquetado']);
if (status !== 0) process.exit(status);

await smokeTest();
console.log('ok  sidecar-java/target/sidecar');

/** Unos pedidos al motor con el runtime de jlink: diccionario, oración, JSON de la caché y, si está, la voz. */
async function smokeTest() {
  const userData = mkdtempSync(join(tmpdir(), 'fonetica-sidecar-'));
  // Una caché de Longman como la que deja la app: al iniciar, el motor la lee con Jackson.
  const lookup = {
    query: 'water',
    status: 'found',
    entries: [{ headword: 'water', pronBrE: 'ˈwɔːtə' }],
  };
  writeFileSync(
    join(userData, 'ldoce-cache.json'),
    JSON.stringify({
      version: 1,
      lookups: { water: { ...lookup, suggestions: [], parserVersion: 3 } },
    }),
  );
  const child = spawn(
    java,
    ['-jar', jar, '--resources', join(root, 'resources'), '--user-data', userData],
    {
      windowsHide: true,
    },
  );
  const requests = [
    { id: 1, channel: 'lexicon:search-spelling', args: ['watre', 3] },
    { id: 2, channel: 'sentence:analyze', args: ['The idea of it.', { connected: true }] },
    { id: 3, channel: 'lexicon:inflections', args: ['watch'] },
    { id: 4, channel: 'tts:available', args: [] },
    { id: 5, channel: 'lexicon:prons-of', args: [['water']] },
  ];
  const answers = new Map();
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('el motor no respondió en 30 s')), 30_000);
      createInterface({ input: child.stdout }).on('line', (line) => {
        const message = JSON.parse(line);
        if (message.ready) {
          for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);
          return;
        }
        answers.set(message.id, message);
        if (answers.size === requests.length) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on('exit', (code) => reject(new Error(`el motor se cerró (código ${code})`)));
    });
    const failed = [...answers.values()].filter((a) => a.error !== undefined);
    if (failed.length) throw new Error(failed.map((a) => a.error).join('; '));
    if (answers.get(5).result.water?.source !== 'ldoce')
      throw new Error('no leyó la caché de Longman');
    if (answers.get(4).result) {
      const wav = await request(child, { id: 6, channel: 'tts:phonemes', args: ['kæt', {}] });
      if (!wav.bytes) throw new Error(`la voz no respondió: ${wav.error}`);
    }
    console.log('ok  el motor responde con su runtime de jlink');
  } catch (error) {
    console.error(stderr);
    console.error(`El motor armado no funciona: ${error.message}`);
    process.exitCode = 1;
  } finally {
    child.stdin.end();
    rmSync(userData, { recursive: true, force: true });
  }
}

function request(child, message) {
  return new Promise((resolve) => {
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      const answer = JSON.parse(line);
      if (answer.id === message.id) {
        lines.close();
        resolve(answer);
      }
    });
    child.stdin.write(`${JSON.stringify(message)}\n`);
  });
}
