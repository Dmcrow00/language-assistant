import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LdoceLookup } from '../../shared/fonetica-api';
import { PARSER_VERSION } from './ldoce-parser';

/**
 * Caché en disco de las consultas a Longman (carpeta de datos del usuario).
 * Cada palabra se pide a Longman una sola vez: después funciona sin conexión y no se
 * le genera tráfico innecesario al sitio.
 */

type StoredLookup = Omit<LdoceLookup, 'fromCache'> & { parserVersion?: number };

interface CacheFile {
  version: 1;
  lookups: Record<string, StoredLookup>;
}

/** Pasado este tiempo se vuelve a consultar (las pronunciaciones casi no cambian). */
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export class LdoceCache {
  private data: CacheFile = { version: 1, lookups: {} };
  private saveTimer: NodeJS.Timeout | undefined;

  constructor(private readonly file: string) {
    try {
      if (existsSync(file)) {
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as CacheFile;
        if (parsed?.version === 1 && parsed.lookups) this.data = parsed;
      }
    } catch {
      // Caché corrupta: se empieza de cero, no es información que se pierda.
    }
  }

  get(query: string): StoredLookup | undefined {
    const hit = this.data.lookups[query];
    if (!hit || hit.parserVersion !== PARSER_VERSION) return undefined;
    if (hit.fetchedAt && Date.now() - Date.parse(hit.fetchedAt) > MAX_AGE_MS) return undefined;
    return hit;
  }

  set(query: string, lookup: StoredLookup): void {
    this.data.lookups[query] = { ...lookup, parserVersion: PARSER_VERSION };
    this.scheduleSave();
  }

  all(): StoredLookup[] {
    return Object.values(this.data.lookups);
  }

  /** Guarda medio segundo después del último cambio, escribiendo primero un temporal. */
  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 500);
  }

  flush(): void {
    clearTimeout(this.saveTimer);
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
    renameSync(tmp, this.file);
  }
}

/** Audios mp3 de Longman guardados en disco, uno por URL (sin el parámetro de versión). */
export class AudioCache {
  constructor(private readonly dir: string) {}

  private pathFor(url: URL): string {
    const name = createHash('sha1').update(url.pathname).digest('hex');
    return join(this.dir, `${name}.mp3`);
  }

  async read(url: URL): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await fsp.readFile(this.pathFor(url)));
    } catch {
      return undefined;
    }
  }

  async write(url: URL, bytes: Uint8Array): Promise<void> {
    await fsp.mkdir(this.dir, { recursive: true });
    await fsp.writeFile(this.pathFor(url), bytes);
  }
}
