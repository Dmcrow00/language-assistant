import { isVowel, PRIMARY_STRESS, SECONDARY_STRESS } from '../../shared/phoneme-inventory';
import type { SentenceAnalysis } from '../../shared/fonetica-api';
import { tokenize } from '../core/ipa';

/**
 * Notación Longman → notación de eSpeak, que es la que "entiende" la voz de Piper (se entrenó con
 * transcripciones de eSpeak, variante "en" = inglés británico). Calibrado contra eSpeak en octubre
 * de 2026 con las palabras de la tabla fonémica (ver electron/test/tts.test.ts):
 *
 *   Longman  æ   e   ɪə   r   u          (cat, bed, here, red, situation)
 *   eSpeak   a   ɛ   iə   ɹ   uː
 *
 * eSpeak pone la marca de acento justo antes de la vocal (kəmpjˈuːtə), no al comienzo de la
 * sílaba como Longman (kəmˈpjuːtə), y también la pone en los monosílabos (kˈat).
 */

const TO_ESPEAK: Readonly<Record<string, string>> = {
  æ: 'a',
  e: 'ɛ',
  ɪə: 'iə',
  r: 'ɹ',
  u: 'uː',
};

/**
 * - keep: respeta las marcas que tenga la transcripción.
 * - ensure: si no tiene acento principal, lo pone en la primera vocal (palabras de contenido,
 *   function words en forma fuerte).
 * - none: sin acento (function words en forma débil).
 */
export type StressMode = 'keep' | 'ensure' | 'none';

/** Convierte la transcripción de una palabra. Los sonidos opcionales "(ə)" se pronuncian. */
export function wordToEspeak(pron: string, stress: StressMode): string {
  const tokens = tokenize(pron.replace(/[()]/g, '')).tokens;
  const hasPrimary = tokens.includes(PRIMARY_STRESS);
  let out = '';
  let pending: string | null = null;
  let stressed = false;
  for (const token of tokens) {
    if (token === PRIMARY_STRESS || token === SECONDARY_STRESS) {
      if (stress === 'keep' || stress === 'ensure') pending = token;
      continue;
    }
    const symbol = TO_ESPEAK[token] ?? token;
    if (isVowel(token)) {
      let mark = pending ?? '';
      if (stress === 'ensure' && !hasPrimary && !stressed) mark = PRIMARY_STRESS;
      if (mark === PRIMARY_STRESS) stressed = true;
      out += mark + symbol;
      pending = null;
    } else {
      out += symbol;
    }
  }
  return out;
}

/**
 * La oración tal como se muestra (formas débiles y fuertes elegidas, r de enlace y, si se pide,
 * los procesos del habla conectada) en notación eSpeak, con la puntuación original para que la voz haga las pausas y la entonación.
 * Las function words débiles van sin acento y las fuertes con acento, así el énfasis se oye.
 */
export function sentenceToEspeak(
  text: string,
  analysis: SentenceAnalysis,
  withProcesses = false,
): string {
  const parts: string[] = [];
  analysis.words.forEach((word, i) => {
    if (!word.pron) return;
    const fw = word.functionWord;
    const stress: StressMode = fw ? (fw.form === 'weak' ? 'none' : 'ensure') : 'ensure';
    const pron =
      withProcesses && word.connectedPron
        ? word.connectedPron
        : word.pron + (word.linkingR ? 'r' : '');
    let part = wordToEspeak(pron, stress);
    const next = analysis.words[i + 1];
    const gap = text.slice(word.end, next ? next.start : text.length);
    const punctuation = gap.match(/[.?!,;:]/)?.[0];
    if (punctuation === '?') part += '?';
    else if (punctuation === '!' || punctuation === '.') part += '.';
    else if (punctuation) part += ',';
    else if (!next) part += '.';
    parts.push(part);
  });
  return parts.join(' ');
}
