import type {
  InflectedForm,
  InflectionInfo,
  PronSource,
  TranscriptionCheck,
} from '../../shared/fonetica-api';
import { phonemeAlignment, phonemeDistance } from './distance';
import { toVariant } from './ipa';
import { edEnding, sEnding } from './sentence';
import { expandLongmanAlternatives, parseLongmanPron } from './transcription';

/**
 * Herramientas de estudio que comparten la sección de fonética y la de gramática:
 * corrección del dictado y pronunciación de las terminaciones -s / -ed.
 */

type PronsOf = (word: string) => { prons: string[]; source: PronSource } | null;

/**
 * Compara lo que escribió el alumno con la transcripción correcta. Se prueba cada variante
 * (alternativas de Longman, sonidos opcionales) y se queda con la más cercana. No cuenta el acento.
 */
export function checkTranscription(
  written: readonly string[],
  expected: string,
): TranscriptionCheck {
  const input = toVariant(written).segments;
  const variants = parseLongmanPron(expected);
  let best = { distance: Infinity, segments: [] as string[] };
  for (const variant of variants) {
    const distance = phonemeDistance(input, variant.segments);
    if (distance < best.distance) best = { distance, segments: variant.segments };
  }
  const alignment = phonemeAlignment(input, best.segments);
  return {
    exact: best.distance === 0,
    distance: Math.round(alignment.distance * 100) / 100,
    alignment: alignment.steps,
    expected: expandLongmanAlternatives(expected)[0] ?? expected,
  };
}

/** -s (plural, 3.ª persona) y -ed (pasado regular) de un verbo: del diccionario o con la regla. */
export function inflections(verb: string, pronsOf: PronsOf): InflectionInfo {
  const base = verb.trim().toLowerCase();
  const basePron = firstPron(pronsOf, base);
  if (!basePron) return { base, basePron: null, s: null, ed: null };

  const sSpelling = /(s|x|z|ch|sh|o)$/.test(base)
    ? `${base}es`
    : /[^aeiou]y$/.test(base)
      ? `${base.slice(0, -1)}ies`
      : `${base}s`;
  const edSpelling = base.endsWith('e')
    ? `${base}d`
    : /[^aeiou]y$/.test(base)
      ? `${base.slice(0, -1)}ied`
      : `${base}ed`;

  return {
    base,
    basePron,
    s: form(sSpelling, basePron, sEnding(basePron, base), pronsOf),
    ed: form(edSpelling, basePron, edEnding(basePron, base), pronsOf),
  };
}

function form(
  spelling: string,
  basePron: string,
  rule: { ending: string; rule: string },
  pronsOf: PronsOf,
): InflectedForm {
  const known = firstPron(pronsOf, spelling);
  return {
    spelling,
    pron: known ?? basePron + rule.ending,
    ending: `/${rule.ending}/`,
    rule: rule.rule,
    fromDictionary: !!known,
  };
}

function firstPron(pronsOf: PronsOf, word: string): string | null {
  const prons = pronsOf(word)?.prons;
  return prons?.length ? (expandLongmanAlternatives(prons[0])[0] ?? null) : null;
}
