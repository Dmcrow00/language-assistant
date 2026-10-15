import type {
  FunctionWordInfo,
  LdoceLookup,
  PronSource,
  SentenceAnalysis,
  SentenceOptions,
  SentenceWord,
} from '../../shared/fonetica-api';
import { isVowel } from '../../shared/phoneme-inventory';
import { FUNCTION_WORDS, FunctionWordForms, decideForm, pickWeakForm } from './function-words';
import { detectProcesses } from './connected-speech';
import { tokenize } from './ipa';
import { expandLongmanAlternatives } from './transcription';

/**
 * Transcripción de oraciones completas.
 *
 * 1. Se separan las palabras y se anotan las pausas (coma → |, fin de oración → ||).
 * 2. Cada palabra toma su transcripción del diccionario local (Longman si ya se consultó,
 *    si no Britfone). Si no está, se intenta armarla desde otra (cats ← cat + -s).
 * 3. Las function words se transcriben en forma fuerte o débil según el contexto
 *    (ver function-words.ts), con las formas de Longman cuando están en caché.
 * 4. Con la palabra siguiente ya resuelta se elige la forma ante vocal (the → ði) y se
 *    agrega la r de enlace (far‿away → /fɑːr əˈweɪ/).
 */

export interface SentenceDeps {
  /** Pronunciaciones de una palabra en el diccionario local. */
  pronsOf(word: string): { prons: string[]; source: PronSource } | null;
  /** Formas débil/fuerte según Longman, si la palabra ya se consultó. */
  longmanForms(word: string): FunctionWordForms | null;
}

interface WordToken {
  text: string;
  key: string;
  start: number;
  end: number;
  pauseAfter?: '|' | '||';
  sentenceInitial: boolean;
  question: boolean;
}

const WORD_PATTERN = /[A-Za-z]+(?:[-'’][A-Za-z]+)*/g;
/** Vocales tras las cuales una r escrita final se pronuncia si sigue otra vocal (r de enlace). */
const LINKING_R_VOWELS = ['ə', 'ɑː', 'ɔː', 'ɜː', 'ɪə', 'eə', 'ʊə'];

export function tokenizeSentence(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    const start = match.index ?? 0;
    const previous = tokens[tokens.length - 1];
    if (previous) previous.pauseAfter = pauseBetween(text.slice(previous.end, start));
    tokens.push({
      text: match[0],
      key: match[0].toLowerCase().replace(/’/g, "'"),
      start,
      end: start + match[0].length,
      sentenceInitial: !previous || previous.pauseAfter === '||',
      question: false,
    });
  }
  const last = tokens[tokens.length - 1];
  if (last) last.pauseAfter = '||';
  // Una oración es pregunta si el próximo signo de cierre después de la palabra es "?".
  for (const token of tokens) {
    const closing = text.slice(token.end).match(/[.!?]/);
    token.question = closing?.[0] === '?';
  }
  return tokens;
}

function pauseBetween(gap: string): '|' | '||' | undefined {
  if (/[.!?]/.test(gap)) return '||';
  if (/[,;:()—–"]/.test(gap)) return '|';
  return undefined;
}

export function analyzeSentence(
  text: string,
  options: SentenceOptions,
  deps: SentenceDeps,
): SentenceAnalysis {
  const tokens = tokenizeSentence(text);
  const forcedStrong = new Set(options.forcedStrong);
  const forcedWeak = new Set(options.forcedWeak);

  // Paso 1: transcripción de cada palabra sin mirar todavía cómo empieza la siguiente.
  const words: SentenceWord[] = tokens.map((token, index) => {
    const base: SentenceWord = {
      index,
      text: token.text,
      start: token.start,
      end: token.end,
      key: token.key,
      pron: null,
      source: null,
      alternatives: [],
      linkingR: false,
      ...(token.pauseAfter ? { pauseAfter: token.pauseAfter } : {}),
    };

    const longman = deps.longmanForms(token.key);
    const forms = longman ?? FUNCTION_WORDS[token.key];
    if (forms) {
      const decision = decideForm({
        key: token.key,
        next: tokens[index + 1]?.key ?? null,
        sentenceInitial: token.sentenceInitial,
        beforePause: !!token.pauseAfter,
        question: token.question,
        override: forcedStrong.has(index) ? 'strong' : forcedWeak.has(index) ? 'weak' : undefined,
        connected: options.connected,
      });
      const info: FunctionWordInfo = {
        category: forms.category,
        form: decision.form,
        weak: forms.weak,
        strong: forms.strong,
        reason: decision.reason,
        forced: options.connected && (forcedStrong.has(index) || forcedWeak.has(index)),
        fromLongman: !!longman,
        ...(forms.weakBeforeVowel ? { weakBeforeVowel: forms.weakBeforeVowel } : {}),
        ...(decision.ambiguous ? { ambiguous: decision.ambiguous } : {}),
      };
      const pron =
        decision.form === 'strong'
          ? forms.strong
          : pickWeakForm(forms.weak, undefined, token.sentenceInitial, false);
      return {
        ...base,
        pron,
        source: longman ? 'ldoce' : 'rule',
        functionWord: info,
        alternatives: alternativesOf(forms, pron),
      };
    }

    const known = deps.pronsOf(token.key);
    if (known && known.prons.length) {
      const all = known.prons.flatMap((p) => expandLongmanAlternatives(p));
      return { ...base, pron: all[0], source: known.source, alternatives: unique(all.slice(1)) };
    }

    const derived = deriveFromBase(token.key, deps);
    return derived ? { ...base, pron: derived.pron, source: 'derived', note: derived.note } : base;
  });

  // Paso 2: forma ante vocal y r de enlace, que dependen de la palabra siguiente.
  words.forEach((word, i) => {
    const next = word.pauseAfter ? undefined : words[i + 1];
    const nextStartsWithVowel = next ? startsWithVowel(next) : false;
    const fw = word.functionWord;
    if (fw && fw.form === 'weak') {
      const sentenceInitial = tokens[i].sentenceInitial;
      word.pron = pickWeakForm(fw.weak, fw.weakBeforeVowel, sentenceInitial, nextStartsWithVowel);
      if (nextStartsWithVowel && fw.weakBeforeVowel)
        fw.reason += ` Ante vocal: /${fw.weakBeforeVowel}/.`;
      word.alternatives = alternativesOf(fw, word.pron);
    }
    if (
      options.connected &&
      next &&
      nextStartsWithVowel &&
      word.pron &&
      takesLinkingR(word.text, word.pron)
    ) {
      word.linkingR = true;
    }
  });

  // Paso 3: procesos del habla conectada (asimilación, elisión…), que se muestran aparte.
  const processes = options.connected ? detectProcesses(words) : [];
  return {
    words,
    transcription: transcriptionLine(words),
    processes,
    connectedTranscription: transcriptionLine(words, true),
  };
}

/** Formas débil/fuerte de Longman a partir de una consulta en caché (sólo si Longman indica "strong"). */
export function longmanFormsFromLookup(lookup: LdoceLookup | undefined): FunctionWordForms | null {
  if (!lookup || lookup.status !== 'found') return null;
  for (const entry of lookup.entries) {
    const forms = entry.pronFormsBrE;
    const strong = forms?.find((f) => /strong/i.test(f.label ?? ''));
    if (!forms || !strong) continue;
    const weak = forms.filter((f) => !f.label).flatMap((f) => expandLongmanAlternatives(f.pron));
    const beforeVowel = forms.find((f) => /before vowel/i.test(f.label ?? ''));
    const table = FUNCTION_WORDS[lookup.query];
    return {
      category: table?.category ?? entry.pos ?? 'function word',
      weak: weak.length ? weak : [strong.pron],
      strong: expandLongmanAlternatives(strong.pron)[0],
      ...(beforeVowel ? { weakBeforeVowel: expandLongmanAlternatives(beforeVowel.pron)[0] } : {}),
    };
  }
  return null;
}

/** /aɪ ˈwɒnt tə ɡəʊ | ənd .../ — las pausas del final no se escriben. */
function transcriptionLine(words: SentenceWord[], withProcesses = false): string {
  const parts = words.map((w, i) => {
    let part =
      withProcesses && w.connectedPron
        ? w.connectedPron
        : (w.pron ?? '?') + (w.linkingR ? 'r' : '');
    if (w.pauseAfter && i < words.length - 1) part += ` ${w.pauseAfter}`;
    return part;
  });
  return parts.length ? `/${parts.join(' ')}/` : '';
}

function alternativesOf(
  forms: Pick<FunctionWordForms, 'weak' | 'weakBeforeVowel' | 'strong'>,
  chosen: string,
): string[] {
  return unique([
    ...forms.weak,
    ...(forms.weakBeforeVowel ? [forms.weakBeforeVowel] : []),
    forms.strong,
  ]).filter((f) => f !== chosen);
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

function phonemesOf(pron: string): string[] {
  return tokenize(pron).tokens.filter((t) => t !== 'ˈ' && t !== 'ˌ');
}

function startsWithVowel(word: SentenceWord): boolean {
  if (word.pron) {
    const first = phonemesOf(word.pron)[0];
    return !!first && isVowel(first);
  }
  // Sin transcripción: se adivina por la ortografía (hour /aʊə/, university /juː/).
  const k = word.key;
  if (/^(hour|honest|honou?r|heir)/.test(k)) return true;
  if (/^(uni|use|usu|euro|one|once)/.test(k)) return false;
  return /^[aeiou]/.test(k);
}

function takesLinkingR(spelling: string, pron: string): boolean {
  if (!/r(e)?$/i.test(spelling)) return false;
  const phonemes = phonemesOf(pron);
  const last = phonemes[phonemes.length - 1];
  return !!last && LINKING_R_VOWELS.includes(last);
}

// --- Palabras que no están en el diccionario: se arman desde la base ------------------------

const SIBILANTS = new Set(['s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ']);
const VOICELESS = new Set(['p', 't', 'k', 'f', 'θ', 's', 'ʃ', 'tʃ']);

interface Derivation {
  pron: string;
  note: string;
}

/** Plurales, tercera persona, pasados, gerundios, posesivos y compuestos con guion. */
function deriveFromBase(key: string, deps: SentenceDeps): Derivation | null {
  const pronOf = (word: string) => {
    const known = deps.pronsOf(word);
    return known?.prons.length ? expandLongmanAlternatives(known.prons[0])[0] : null;
  };
  const attempt = (
    bases: string[],
    suffix: (basePron: string, base: string) => string,
    label: string,
  ) => {
    for (const base of bases) {
      const basePron = base.length > 1 ? pronOf(base) : null;
      if (basePron)
        return {
          pron: basePron + suffix(basePron, base),
          note: `Armada a partir de «${base}» + ${label}.`,
        };
    }
    return null;
  };

  if (key.includes('-')) {
    const parts = key.split('-').map(pronOf);
    if (parts.every((p) => p))
      return { pron: parts.join(''), note: 'Armada uniendo las partes del compuesto.' };
  }

  const contraction = key.match(/^(.+)'(s|ll|ve|d|re)$/);
  if (contraction) {
    const [, base, ending] = contraction;
    const endings: Record<string, (p: string) => string> = {
      s: (p) => sSuffix(p),
      ll: () => 'l',
      ve: () => 'v',
      d: () => 'd',
      re: () => 'ə',
    };
    return attempt([base], (p) => endings[ending](p), `'${ending}`);
  }

  if (key.endsWith('ies')) return attempt([key.slice(0, -3) + 'y'], (p) => 'z', '-s');
  if (/(s|x|z|ch|sh)es$/.test(key))
    return attempt([key.slice(0, -2)], (p, b) => linking(p, b) + 'ɪz', '-es');
  if (key.endsWith('s') && !key.endsWith('ss'))
    return attempt([key.slice(0, -1)], (p, b) => sSuffix(p, b), '-s');
  if (key.endsWith('ied')) return attempt([key.slice(0, -3) + 'y'], () => 'd', '-ed');
  if (key.endsWith('ed')) {
    return attempt(
      [key.slice(0, -2), key.slice(0, -1), undouble(key.slice(0, -2))],
      (p, b) => edSuffix(p, b),
      '-ed',
    );
  }
  if (key.endsWith('ing')) {
    const stem = key.slice(0, -3);
    return attempt([stem, stem + 'e', undouble(stem)], (p, b) => linking(p, b) + 'ɪŋ', '-ing');
  }
  return null;
}

function lastPhoneme(pron: string): string | undefined {
  const phonemes = phonemesOf(pron);
  return phonemes[phonemes.length - 1];
}

/** La r escrita de la base se pronuncia si el sufijo empieza con vocal (water → watering /ˈwɔːtərɪŋ/). */
function linking(basePron: string, base: string): string {
  return takesLinkingR(base, basePron) ? 'r' : '';
}

/** Terminación -s y la regla que la explica. */
export function sEnding(basePron: string, base = ''): { ending: string; rule: string } {
  const last = lastPhoneme(basePron) ?? '';
  if (SIBILANTS.has(last)) {
    return {
      ending: linking(basePron, base) + 'ɪz',
      rule: `/ɪz/ porque la base termina en una sibilante (/${last}/).`,
    };
  }
  return VOICELESS.has(last)
    ? { ending: 's', rule: `/s/ porque la base termina en una consonante sorda (/${last}/).` }
    : { ending: 'z', rule: `/z/ porque la base termina en un sonido sonoro (/${last}/).` };
}

/** Terminación -ed y la regla que la explica. */
export function edEnding(basePron: string, base = ''): { ending: string; rule: string } {
  const last = lastPhoneme(basePron) ?? '';
  if (last === 't' || last === 'd') {
    return {
      ending: linking(basePron, base) + 'ɪd',
      rule: `/ɪd/ porque la base termina en /${last}/.`,
    };
  }
  return VOICELESS.has(last)
    ? { ending: 't', rule: `/t/ porque la base termina en una consonante sorda (/${last}/).` }
    : { ending: 'd', rule: `/d/ porque la base termina en un sonido sonoro (/${last}/).` };
}

function sSuffix(basePron: string, base = ''): string {
  const last = lastPhoneme(basePron) ?? '';
  if (SIBILANTS.has(last)) return linking(basePron, base) + 'ɪz';
  return VOICELESS.has(last) ? 's' : 'z';
}

function edSuffix(basePron: string, base: string): string {
  const last = lastPhoneme(basePron) ?? '';
  if (last === 't' || last === 'd') return linking(basePron, base) + 'ɪd';
  return VOICELESS.has(last) ? 't' : 'd';
}

/** stopp → stop, runn → run (consonante duplicada antes del sufijo). */
function undouble(stem: string): string {
  return stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]
    ? stem.slice(0, -1)
    : stem;
}
