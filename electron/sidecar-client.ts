import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * Cliente del motor Java (sidecar-java/), que corre como proceso aparte (ADR-0002, ADR-0001 del repo).
 *
 * Protocolo: una línea JSON por mensaje, por stdin y stdout.
 *   pedido:     {"id": 7, "channel": "lexicon:search-spelling", "args": ["watre", 25]}
 *   respuesta:  {"id": 7, "result": ...}  ·  {"id": 7, "bytes": "<base64>"}  ·  {"id": 7, "error": "..."}
 * Al arrancar escribe {"ready": true, ...} cuando ya cargó el diccionario.
 *
 * El proceso se lanza al iniciar la app y queda vivo; si se cae, el próximo pedido lo vuelve a lanzar.
 * Cerrar su stdin le pide que guarde la caché de Longman y termine.
 */

/** Cómo lanzar el motor. */
export interface SidecarCommand {
  file: string;
  args: string[];
}

/** Más que los 30 s que el motor le da a spaCy: el análisis gramatical puede incluir su arranque. */
const REQUEST_TIMEOUT_MS = 60_000;

interface Message {
  ready?: boolean;
  id?: number | null;
  result?: unknown;
  bytes?: string;
  error?: string;
}

export class SidecarClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<void> | null = null;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (e: Error) => void }
  >();
  private nextId = 1;

  constructor(
    private readonly command: SidecarCommand,
    private readonly timeoutMs = REQUEST_TIMEOUT_MS,
  ) {}

  /**
   * Busca el motor: en el instalador, el runtime de Java y el jar de resources/sidecar; en desarrollo,
   * el jar de sidecar-java/target/sidecar con el Java de JAVA_HOME. null si no está compilado.
   */
  static locate(options: {
    resourcesDir: string;
    projectDir: string;
    packaged: boolean;
    userData: string;
    userAgent: string;
  }): SidecarClient | null {
    const base = options.packaged
      ? join(options.resourcesDir, 'sidecar')
      : join(options.projectDir, 'sidecar-java', 'target', 'sidecar');
    const jar = join(base, 'fonetica-sidecar.jar');
    if (!existsSync(jar)) return null;
    const javaExe = process.platform === 'win32' ? 'java.exe' : 'java';
    const bundledJava = join(base, 'runtime', 'bin', javaExe);
    const java = existsSync(bundledJava)
      ? bundledJava
      : process.env.JAVA_HOME
        ? join(process.env.JAVA_HOME, 'bin', javaExe)
        : 'java';
    const args = [
      '-Dstdout.encoding=UTF-8',
      '-Dstderr.encoding=UTF-8',
      // Un proceso chico de escritorio: el recolector serial usa menos memoria que el de por defecto.
      '-XX:+UseSerialGC',
      '-jar',
      jar,
      '--resources',
      options.resourcesDir,
      '--user-data',
      options.userData,
      '--user-agent',
      options.userAgent,
    ];
    if (!options.packaged) args.push('--project', options.projectDir);
    return new SidecarClient({ file: java, args });
  }

  /** Lanza el motor sin esperar un pedido (así carga el diccionario mientras se abre la ventana). */
  warmUp(): void {
    this.start().catch((error: Error) => console.error(`[motor] ${error.message}`));
  }

  /** Manda un pedido al motor. Los canales de audio devuelven los bytes del archivo. */
  async call<T>(channel: string, ...args: unknown[]): Promise<T> {
    await this.start();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('El motor tardó demasiado en responder.'));
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.process?.stdin.write(`${JSON.stringify({ id, channel, args })}\n`);
    });
  }

  /** Cierra la entrada del motor: guarda lo pendiente y termina solo. */
  dispose(): void {
    this.process?.stdin.end();
    this.process = null;
    this.ready = null;
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const child = spawn(this.command.file, this.command.args, { windowsHide: true });
      this.process = child;
      child.stdin.setDefaultEncoding('utf8');
      let started = false;
      // Los avisos del motor van por stderr: a la consola de Electron.
      createInterface({ input: child.stderr }).on('line', (line) =>
        console.error(`[motor] ${line}`),
      );
      createInterface({ input: child.stdout }).on('line', (line) => {
        let message: Message;
        try {
          message = JSON.parse(line) as Message;
        } catch {
          return; // líneas que no son del protocolo
        }
        if (message.ready) {
          started = true;
          resolve();
          return;
        }
        const id = message.id;
        const waiter = typeof id === 'number' ? this.pending.get(id) : undefined;
        if (!waiter || typeof id !== 'number') return;
        this.pending.delete(id);
        if (message.error !== undefined) waiter.reject(new Error(message.error));
        else if (message.bytes !== undefined)
          waiter.resolve(new Uint8Array(Buffer.from(message.bytes, 'base64')));
        else waiter.resolve(message.result);
      });
      const fail = (reason: string) => {
        const error = new Error(reason);
        if (!started) reject(error);
        for (const waiter of this.pending.values()) waiter.reject(error);
        this.pending.clear();
        if (this.process === child) {
          this.process = null;
          this.ready = null;
        }
      };
      child.on('error', (error) => fail(`No se pudo iniciar el motor: ${error.message}`));
      child.on('exit', (code) => fail(`El motor se cerró (código ${code}).`));
    });
    return this.ready;
  }
}
