import type { LdoceLookup } from '../../shared/fonetica-api';
import { AudioCache, LdoceCache } from './ldoce-cache';
import { parseEntryPage, parseSpellcheckPage } from './ldoce-parser';

/**
 * Consulta a Longman Dictionary of Contemporary English Online.
 *
 * Longman no tiene una API pública (la de Pearson se dio de baja), así que se lee la misma
 * página que vería el alumno en el navegador, sólo cuando el alumno busca una palabra:
 * - una consulta por vez y como mínimo un segundo entre consultas;
 * - todo queda en caché, cada palabra se pide una sola vez;
 * - nunca se recorre el diccionario entero.
 */

export const LDOCE_ORIGIN = 'https://www.ldoceonline.com';

/** Lo mínimo que necesitamos de fetch, para poder probar el cliente sin red. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export class LdoceClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(
    private readonly fetchFn: FetchLike,
    private readonly cache: LdoceCache,
    private readonly audioCache: AudioCache,
    private readonly minIntervalMs = 1000,
  ) {}

  /** Lo que ya se consultó antes, sin ir a la red (undefined si nunca se pidió). */
  cached(rawQuery: string): LdoceLookup | undefined {
    const hit = this.cache.get(normalizeQuery(rawQuery));
    return hit ? { ...hit, fromCache: true } : undefined;
  }

  async lookup(rawQuery: string): Promise<LdoceLookup> {
    const query = normalizeQuery(rawQuery);
    const cached = this.cache.get(query);
    if (cached) return { ...cached, fromCache: true };

    try {
      // "direct" redirige a /dictionary/<palabra> si existe, o a /spellcheck/ con sugerencias.
      const url = `${LDOCE_ORIGIN}/search/english/direct/?q=${encodeURIComponent(query)}`;
      const response = await this.throttled(() =>
        this.fetchFn(url, { headers: { 'Accept-Language': 'en-GB,en;q=0.8' } }),
      );
      if (!response.ok) {
        return offline(query, `Longman respondió con el código ${response.status}.`);
      }
      const html = await response.text();
      const finalUrl = response.url || url;
      const fetchedAt = new Date().toISOString();

      // Se decide por el contenido y no por la URL final: no todas las implementaciones de fetch
      // informan a dónde redirigió Longman.
      let lookup: Omit<LdoceLookup, 'fromCache'>;
      const entries = finalUrl.includes('/spellcheck/') ? [] : parseEntryPage(html);
      if (entries.length) {
        lookup = { query, status: 'found', entries, suggestions: [], pageUrl: finalUrl, fetchedAt };
      } else {
        const suggestions = parseSpellcheckPage(html);
        lookup = {
          query,
          status: suggestions.length ? 'suggestions' : 'not-found',
          entries: [],
          suggestions,
          fetchedAt,
        };
      }
      // "No encontrada" no se guarda: es barato volver a preguntar y evita arrastrar un error de lectura.
      if (lookup.status !== 'not-found') this.cache.set(query, lookup);
      return { ...lookup, fromCache: false };
    } catch (error) {
      return offline(query, error instanceof Error ? error.message : String(error));
    }
  }

  /** Sólo se aceptan audios del propio Longman: el renderer no puede pedir URLs arbitrarias. */
  async audio(rawUrl: string): Promise<Uint8Array> {
    const url = new URL(rawUrl);
    if (
      url.origin !== LDOCE_ORIGIN ||
      !url.pathname.startsWith('/media/') ||
      !url.pathname.endsWith('.mp3')
    ) {
      throw new Error('URL de audio no permitida');
    }
    const cached = await this.audioCache.read(url);
    if (cached) return cached;
    const response = await this.throttled(() => this.fetchFn(url.toString()));
    if (!response.ok) throw new Error(`No se pudo descargar el audio (código ${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await this.audioCache.write(url, bytes);
    return bytes;
  }

  /** Encola los pedidos para que salgan de a uno y con el intervalo mínimo entre sí. */
  private throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        return await task();
      } finally {
        this.lastRequestAt = Date.now();
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function offline(query: string, message: string): LdoceLookup {
  return { query, status: 'offline', entries: [], suggestions: [], fromCache: false, message };
}
