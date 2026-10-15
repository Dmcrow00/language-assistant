import { ipcMain, IpcMainInvokeEvent, nativeTheme, shell } from 'electron';
import { IPC, LdoceLookup, PhonemeSearchOptions } from '../shared/fonetica-api';
import { PHONEMES, PRIMARY_STRESS, SECONDARY_STRESS } from '../shared/phoneme-inventory';
import { Lexicon, normalizeKey } from './core/lexicon';
import { analyzeSentence, longmanFormsFromLookup } from './core/sentence';
import { checkTranscription, inflections } from './core/study-tools';
import { NlpClient } from './grammar/nlp-client';
import { analyzeGrammar } from './grammar/quirk-analysis';
import { sentenceToEspeak, wordToEspeak } from './tts/espeak-notation';
import { PiperVoice } from './tts/piper-voice';
import { LDOCE_ORIGIN, LdoceClient } from './ldoce/ldoce-client';

/**
 * Handlers IPC: la única puerta entre la interfaz y el motor. Todo lo que llega del renderer
 * se valida acá (tipos, largos, fonemas conocidos) antes de usarlo.
 */

const VALID_TOKENS = new Set([...PHONEMES.map((p) => p.symbol), PRIMARY_STRESS, SECONDARY_STRESS]);

/** Duración de los fonemas en modo lento (1 = normal). */
const SLOW_LENGTH_SCALE = 1.45;

export interface IpcDeps {
  lexicon: Lexicon;
  ldoce: LdoceClient;
  /** null si la voz no está instalada (npm run fetch-voice). */
  voice: PiperVoice | null;
  /** null si el analizador gramatical no está (npm run build:nlp). */
  nlp: NlpClient | null;
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
}

export function registerIpc({ lexicon, ldoce, voice, nlp, isTrustedSender }: IpcDeps): void {
  const handle = (channel: string, fn: (...args: unknown[]) => unknown) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event)) throw new Error('Origen no permitido');
      return fn(...args);
    });

  handle(IPC.searchSpelling, (query, limit) =>
    lexicon.searchSpelling(text(query, 60), count(limit, 25)),
  );

  handle(IPC.searchPhonemes, (phonemes, options) => {
    const tokens = Array.isArray(phonemes)
      ? phonemes.filter((t): t is string => VALID_TOKENS.has(t as string))
      : [];
    const opts = (options ?? {}) as Partial<PhonemeSearchOptions>;
    return lexicon.searchPhonemes(tokens.slice(0, 40), {
      useStress: opts.useStress === true,
      limit: count(opts.limit, 40),
    });
  });

  handle(IPC.lexiconInfo, () => lexicon.info());

  handle(IPC.lookupLdoce, async (word) => {
    const lookup = await ldoce.lookup(text(word, 60));
    applyLookupToLexicon(lexicon, lookup);
    return lookup;
  });

  handle(IPC.getAudio, (url) => ldoce.audio(text(url, 300)));

  const analyze = (sentence: string, options: unknown) => {
    const opts = (options ?? {}) as {
      connected?: unknown;
      forcedStrong?: unknown;
      forcedWeak?: unknown;
    };
    return analyzeSentence(
      sentence,
      {
        connected: opts.connected !== false,
        forcedStrong: indexes(opts.forcedStrong),
        forcedWeak: indexes(opts.forcedWeak),
      },
      {
        pronsOf: (word) => lexicon.pronsOf(word),
        longmanForms: (word) => longmanFormsFromLookup(ldoce.cached(word)),
      },
    );
  };
  const tokensOf = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((t): t is string => VALID_TOKENS.has(t as string)).slice(0, 60)
      : [];
  const speech = (options: unknown) => ({
    lengthScale: (options as { slow?: unknown } | undefined)?.slow === true ? SLOW_LENGTH_SCALE : 1,
  });
  const requireVoice = () => {
    if (!voice) throw new Error('La voz británica no está instalada (npm run fetch-voice).');
    return voice;
  };

  handle(IPC.analyzeSentence, (sentence, options) => analyze(text(sentence, 500), options));

  handle(IPC.voiceAvailable, () => !!voice);

  // La voz lee la misma transcripción que se muestra: con las formas débiles/fuertes elegidas.
  handle(IPC.speakSentence, (sentence, options) => {
    const value = text(sentence, 500);
    const withProcesses = (options as { processes?: unknown } | undefined)?.processes === true;
    return requireVoice().synthesize(
      sentenceToEspeak(value, analyze(value, options), withProcesses),
      speech(options),
    );
  });

  handle(IPC.pronsOf, (words) => {
    const list = Array.isArray(words)
      ? words.filter((w): w is string => typeof w === 'string').slice(0, 500)
      : [];
    return Object.fromEntries(list.map((w) => [w, lexicon.pronsOf(w.slice(0, 60))]));
  });

  handle(IPC.checkTranscription, (written, expected) =>
    checkTranscription(tokensOf(written), text(expected, 200)),
  );

  handle(IPC.inflections, (verb) => inflections(text(verb, 40), (w) => lexicon.pronsOf(w)));

  handle(IPC.grammarAvailable, () => !!nlp);

  handle(IPC.analyzeGrammar, async (sentence) => {
    if (!nlp) throw new Error('El analizador gramatical no está instalado (npm run build:nlp).');
    return analyzeGrammar(await nlp.parse(text(sentence, 1000)));
  });

  handle(IPC.speakPhonemes, (pron, options) =>
    requireVoice().synthesize(`${wordToEspeak(text(pron, 200), 'ensure')}.`, speech(options)),
  );

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

/** Las palabras consultadas en Longman pasan a usar su transcripción también en la búsqueda por fonemas. */
export function applyLookupToLexicon(
  lexicon: Lexicon,
  lookup: Pick<LdoceLookup, 'status' | 'entries'>,
): void {
  if (lookup.status !== 'found') return;
  // Agrupa por palabra sin distinguir mayúsculas ("record" sustantivo y verbo tienen dos pronunciaciones).
  const byKey = new Map<string, { headword: string; prons: string[] }>();
  for (const entry of lookup.entries) {
    if (!entry.pronBrE) continue;
    const key = normalizeKey(entry.headword);
    const group = byKey.get(key) ?? { headword: entry.headword, prons: [] };
    group.prons.push(...(entry.pronFormsBrE?.map((f) => f.pron) ?? [entry.pronBrE]));
    byKey.set(key, group);
  }
  for (const { headword, prons } of byKey.values()) lexicon.upsertFromLdoce(headword, prons);
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new Error('Se esperaba un texto');
  return value.slice(0, maxLength);
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
