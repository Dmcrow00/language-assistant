import { ipcMain, IpcMainInvokeEvent, nativeTheme, shell } from 'electron';
import { IPC, PhonemeSearchOptions } from '../shared/fonetica-api';
import { PHONEMES, PRIMARY_STRESS, SECONDARY_STRESS } from '../shared/phoneme-inventory';

/**
 * Handlers IPC: la única puerta entre la interfaz y el motor. Todo lo que llega del renderer se valida
 * acá (remitente, tipos, largos, fonemas conocidos) y después se reenvía al motor Java, que lo vuelve a
 * validar (ADR-0002). Sólo dos canales se resuelven en Electron: abrir Longman en el navegador y el tema
 * de la ventana.
 */

export const LDOCE_ORIGIN = 'https://www.ldoceonline.com';

const VALID_TOKENS = new Set([...PHONEMES.map((p) => p.symbol), PRIMARY_STRESS, SECONDARY_STRESS]);

/** Lo que el IPC necesita del motor: mandar un pedido por canal. */
export interface Engine {
  call<T>(channel: string, ...args: unknown[]): Promise<T>;
}

export interface IpcDeps {
  /** null si el motor no está compilado (npm run build:sidecar). */
  engine: Engine | null;
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
}

export function registerIpc({ engine, isTrustedSender }: IpcDeps): void {
  const handle = (channel: string, fn: (...args: unknown[]) => unknown) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event)) throw new Error('Origen no permitido');
      return fn(...args);
    });
  const forward = (channel: string, ...args: unknown[]) => {
    if (!engine) throw new Error('El motor no está compilado (npm run build:sidecar).');
    return engine.call(channel, ...args);
  };

  handle(IPC.searchSpelling, (query, limit) =>
    forward(IPC.searchSpelling, text(query, 60), count(limit, 25)),
  );

  handle(IPC.searchPhonemes, (phonemes, options) => {
    const opts = (options ?? {}) as Partial<PhonemeSearchOptions>;
    return forward(IPC.searchPhonemes, tokens(phonemes, 40), {
      useStress: opts.useStress === true,
      limit: count(opts.limit, 40),
    });
  });

  handle(IPC.lexiconInfo, () => forward(IPC.lexiconInfo));

  handle(IPC.lookupLdoce, (word) => forward(IPC.lookupLdoce, text(word, 60)));

  handle(IPC.getAudio, (url) => forward(IPC.getAudio, text(url, 300)));

  handle(IPC.analyzeSentence, (sentence, options) =>
    forward(IPC.analyzeSentence, text(sentence, 500), sentenceOptions(options)),
  );

  handle(IPC.voiceAvailable, () => forward(IPC.voiceAvailable));

  handle(IPC.speakSentence, (sentence, options) =>
    forward(IPC.speakSentence, text(sentence, 500), {
      ...sentenceOptions(options),
      ...speechOptions(options),
      processes: (options as { processes?: unknown } | undefined)?.processes === true,
    }),
  );

  handle(IPC.speakPhonemes, (pron, options) =>
    forward(IPC.speakPhonemes, text(pron, 200), speechOptions(options)),
  );

  handle(IPC.pronsOf, (words) =>
    forward(
      IPC.pronsOf,
      Array.isArray(words)
        ? words.filter((w): w is string => typeof w === 'string').slice(0, 500)
        : [],
    ),
  );

  handle(IPC.checkTranscription, (written, expected) =>
    forward(IPC.checkTranscription, tokens(written, 60), text(expected, 200)),
  );

  handle(IPC.inflections, (verb) => forward(IPC.inflections, text(verb, 40)));

  handle(IPC.grammarAvailable, () => forward(IPC.grammarAvailable));

  handle(IPC.analyzeGrammar, (sentence) => forward(IPC.analyzeGrammar, text(sentence, 1000)));

  handle(IPC.setTheme, (theme) => {
    if (theme !== 'system' && theme !== 'light' && theme !== 'dark')
      throw new Error('Tema inválido');
    nativeTheme.themeSource = theme;
  });

  handle(IPC.openInBrowser, async (url) => {
    const target = new URL(text(url, 300));
    if (target.origin !== LDOCE_ORIGIN) throw new Error('Sólo se abren páginas de Longman');
    await shell.openExternal(target.toString());
  });
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new Error('Se esperaba un texto');
  return value.slice(0, maxLength);
}

function tokens(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((t): t is string => VALID_TOKENS.has(t as string)).slice(0, max)
    : [];
}

function sentenceOptions(options: unknown) {
  const opts = (options ?? {}) as {
    connected?: unknown;
    forcedStrong?: unknown;
    forcedWeak?: unknown;
  };
  return {
    connected: opts.connected !== false,
    forcedStrong: indexes(opts.forcedStrong),
    forcedWeak: indexes(opts.forcedWeak),
  };
}

function speechOptions(options: unknown) {
  return { slow: (options as { slow?: unknown } | undefined)?.slow === true };
}

function indexes(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < 200)
    : [];
}

function count(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 100
    ? value
    : fallback;
}
