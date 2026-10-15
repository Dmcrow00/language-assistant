import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * Cliente del analizador spaCy (nlp/nlp_server.py), que corre como proceso aparte.
 *
 * - En el ejecutable se usa la versión empaquetada con PyInstaller (resources/nlp/nlp-server).
 * - En desarrollo, si no se empaquetó todavía, se usa el Python del entorno nlp/.venv.
 * El proceso se lanza la primera vez que se pide un análisis (tarda ~1,5 s en cargar el modelo)
 * y queda vivo; si se cae, el próximo pedido lo vuelve a lanzar.
 */

/** Token tal como lo devuelve spaCy. */
export interface ParsedToken {
  i: number;
  text: string;
  ws: string;
  idx: number;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
  head: number;
  morph: string;
  sentStart: boolean;
}

interface Command {
  file: string;
  args: string[];
}

const REQUEST_TIMEOUT_MS = 30_000;

export class NlpClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<void> | null = null;
  private readonly pending = new Map<
    number,
    { resolve: (t: ParsedToken[]) => void; reject: (e: Error) => void }
  >();
  private nextId = 1;

  constructor(private readonly command: Command) {}

  /** Busca el analizador: primero el empaquetado, después el entorno de desarrollo. */
  static locate(resourcesDir: string, projectDir: string): NlpClient | null {
    const packaged = join(resourcesDir, 'nlp', 'nlp-server', 'nlp-server.exe');
    if (existsSync(packaged)) return new NlpClient({ file: packaged, args: [] });
    const python = join(projectDir, 'nlp', '.venv', 'Scripts', 'python.exe');
    const script = join(projectDir, 'nlp', 'nlp_server.py');
    if (existsSync(python) && existsSync(script))
      return new NlpClient({ file: python, args: [script] });
    return null;
  }

  async parse(text: string): Promise<ParsedToken[]> {
    await this.start();
    const id = this.nextId++;
    return new Promise<ParsedToken[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('El analizador tardó demasiado en responder.'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (tokens) => {
          clearTimeout(timer);
          resolve(tokens);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.process?.stdin.write(`${JSON.stringify({ id, text })}\n`);
    });
  }

  dispose(): void {
    this.process?.kill();
    this.process = null;
    this.ready = null;
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const child = spawn(this.command.file, this.command.args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });
      this.process = child;
      child.stdin.setDefaultEncoding('utf8');
      let started = false;
      const lines = createInterface({ input: child.stdout });
      lines.on('line', (line) => {
        let message: { ready?: boolean; id?: number; tokens?: ParsedToken[]; error?: string };
        try {
          message = JSON.parse(line);
        } catch {
          return; // líneas que no son del protocolo (avisos de librerías)
        }
        if (message.ready) {
          started = true;
          resolve();
          return;
        }
        const waiter = message.id !== undefined ? this.pending.get(message.id) : undefined;
        if (!waiter || message.id === undefined) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error));
        else waiter.resolve(message.tokens ?? []);
      });
      const fail = (reason: string) => {
        const error = new Error(reason);
        if (!started) reject(error);
        for (const waiter of this.pending.values()) waiter.reject(error);
        this.pending.clear();
        this.process = null;
        this.ready = null;
      };
      child.on('error', (error) => fail(`No se pudo iniciar el analizador: ${error.message}`));
      child.on('exit', (code) => fail(`El analizador se cerró (código ${code}).`));
    });
    return this.ready;
  }
}
