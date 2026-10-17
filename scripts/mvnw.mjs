// Corre el Maven Wrapper del motor Java (sidecar-java/) con los argumentos que se le pasen:
//
//   node scripts/mvnw.mjs -B verify
//
// Usa el JDK de JAVA_HOME (Java 25); en Windows llama a mvnw.cmd y en el CI de Linux a mvnw.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sidecarDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sidecar-java');

export function mvnw(args) {
  const windows = process.platform === 'win32';
  // Desde Node 20 los .cmd de Windows sólo se pueden lanzar a través de la consola (shell); con la ruta
  // completa entre comillas porque la consola no siempre busca en la carpeta actual.
  const result = spawnSync(windows ? `"${join(sidecarDir, 'mvnw.cmd')}"` : './mvnw', args, {
    cwd: sidecarDir,
    stdio: 'inherit',
    shell: windows,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(mvnw(process.argv.slice(2)));
}
