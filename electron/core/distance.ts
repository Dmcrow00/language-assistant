import type { AlignmentStep } from '../../shared/fonetica-api';
import { isVowel } from '../../shared/phoneme-inventory';

/**
 * Distancias para encontrar "lo más parecido".
 *
 * - Ortografía: distancia de Damerau-Levenshtein restringida (OSA): cada letra cambiada,
 *   agregada, borrada o dos letras invertidas ("watre" → "water") cuesta 1.
 * - Fonemas: distancia de edición con costos según cuán parecidos suenan. Confundir /ɪ/ con /iː/
 *   cuesta menos que confundir /ɪ/ con /ɑː/; agregar una /r/ (error típico de hablantes de
 *   variedades róticas) cuesta poco. Los valores están en tablas para poder ajustarlos.
 */

export function osaDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, d[i - 2][j - 2] + 1);
      }
      d[i][j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Pares de fonemas que se confunden con facilidad y cuánto cuesta cambiar uno por otro (0–1). */
const SIMILAR_PAIRS: ReadonlyArray<[string, string, number]> = [
  // Vocales: largas/cortas y vecinas en el trapecio vocálico
  ['ɪ', 'iː', 0.4],
  ['ɪ', 'i', 0.3],
  ['i', 'iː', 0.3],
  ['ʊ', 'uː', 0.4],
  ['ʊ', 'u', 0.3],
  ['u', 'uː', 0.3],
  ['æ', 'e', 0.5],
  ['æ', 'ʌ', 0.5],
  ['ʌ', 'ɑː', 0.5],
  ['æ', 'ɑː', 0.6],
  ['ɒ', 'ɔː', 0.5],
  ['ɒ', 'ʌ', 0.6],
  ['ɒ', 'ɑː', 0.6],
  ['ə', 'ʌ', 0.4],
  ['ə', 'ɜː', 0.5],
  ['ə', 'ɪ', 0.5],
  ['ə', 'i', 0.6],
  ['ə', 'e', 0.6],
  ['ə', 'ʊ', 0.6],
  ['ə', 'u', 0.6],
  ['ɜː', 'e', 0.7],
  ['ɜː', 'ʌ', 0.7],
  // Diptongos y su vocal más cercana
  ['eɪ', 'e', 0.5],
  ['eɪ', 'iː', 0.7],
  ['aɪ', 'eɪ', 0.6],
  ['aɪ', 'æ', 0.7],
  ['aɪ', 'ɑː', 0.7],
  ['ɔɪ', 'ɔː', 0.7],
  ['əʊ', 'ɒ', 0.6],
  ['əʊ', 'ɔː', 0.6],
  ['əʊ', 'uː', 0.7],
  ['aʊ', 'əʊ', 0.6],
  ['aʊ', 'ɑː', 0.7],
  ['ɪə', 'iː', 0.6],
  ['ɪə', 'ɪ', 0.6],
  ['eə', 'e', 0.5],
  ['eə', 'ɜː', 0.7],
  ['ʊə', 'ɔː', 0.4],
  ['ʊə', 'uː', 0.6],
  ['ʊə', 'ʊ', 0.6],
  // Consonantes: pares sorda/sonora
  ['p', 'b', 0.4],
  ['t', 'd', 0.4],
  ['k', 'ɡ', 0.4],
  ['f', 'v', 0.4],
  ['θ', 'ð', 0.3],
  ['s', 'z', 0.4],
  ['ʃ', 'ʒ', 0.4],
  ['tʃ', 'dʒ', 0.4],
  // Consonantes: punto o modo de articulación cercano
  ['θ', 't', 0.5],
  ['ð', 'd', 0.5],
  ['θ', 'f', 0.6],
  ['ð', 'v', 0.6],
  ['θ', 's', 0.6],
  ['ð', 'z', 0.6],
  ['s', 'ʃ', 0.5],
  ['z', 'ʒ', 0.5],
  ['tʃ', 'ʃ', 0.5],
  ['dʒ', 'ʒ', 0.5],
  ['dʒ', 'j', 0.6],
  ['tʃ', 't', 0.6],
  ['dʒ', 'd', 0.6],
  ['b', 'v', 0.5],
  ['w', 'v', 0.6],
  ['m', 'n', 0.6],
  ['n', 'ŋ', 0.4],
  ['l', 'r', 0.7],
  ['r', 'w', 0.7],
];

const DEFAULT_VOWEL_VOWEL = 0.85;
const DEFAULT_CONSONANT_CONSONANT = 0.9;
const VOWEL_CONSONANT = 1.3;
const DEFAULT_INDEL = 1;

/** Fonemas que se agregan u omiten seguido sin cambiar mucho la palabra. */
const INDEL_COST: ReadonlyMap<string, number> = new Map([
  ['ə', 0.5], // elisión de schwa: ˈɡʌv(ə)mənt
  ['r', 0.5], // /r/ final o preconsonántica que el RP no pronuncia
  ['j', 0.6], // yod: /njuː/ ~ /nuː/
  ['h', 0.7],
  ['i', 0.7],
  ['u', 0.7],
]);

const pairCost = new Map<string, number>();
for (const [a, b, cost] of SIMILAR_PAIRS) {
  pairCost.set(`${a}|${b}`, cost);
  pairCost.set(`${b}|${a}`, cost);
}

export function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  const known = pairCost.get(`${a}|${b}`);
  if (known !== undefined) return known;
  const va = isVowel(a);
  const vb = isVowel(b);
  if (va && vb) return DEFAULT_VOWEL_VOWEL;
  if (!va && !vb) return DEFAULT_CONSONANT_CONSONANT;
  return VOWEL_CONSONANT;
}

export function indelCost(phoneme: string): number {
  return INDEL_COST.get(phoneme) ?? DEFAULT_INDEL;
}

const MIN_INDEL = Math.min(DEFAULT_INDEL, ...INDEL_COST.values());

/**
 * Distancia entre lo que escribió el alumno y una transcripción.
 * Corta antes si ya se pasó de `max` (devuelve Infinity): así recorrer 16 000 palabras es instantáneo.
 */
export function phonemeDistance(
  written: readonly string[],
  expected: readonly string[],
  max = Infinity,
): number {
  if (Math.abs(written.length - expected.length) * MIN_INDEL > max) return Infinity;
  let previous = new Array<number>(expected.length + 1);
  let current = new Array<number>(expected.length + 1);
  previous[0] = 0;
  for (let j = 1; j <= expected.length; j++)
    previous[j] = previous[j - 1] + indelCost(expected[j - 1]);
  for (let i = 1; i <= written.length; i++) {
    current[0] = previous[0] + indelCost(written[i - 1]);
    let rowMin = current[0];
    for (let j = 1; j <= expected.length; j++) {
      current[j] = Math.min(
        previous[j] + indelCost(written[i - 1]), // el alumno escribió de más
        current[j - 1] + indelCost(expected[j - 1]), // al alumno le faltó
        previous[j - 1] + substitutionCost(written[i - 1], expected[j - 1]),
      );
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return Infinity;
    [previous, current] = [current, previous];
  }
  return previous[expected.length];
}

/** Igual que phonemeDistance pero además devuelve el paso a paso para mostrar qué no coincidió. */
export function phonemeAlignment(
  written: readonly string[],
  expected: readonly string[],
): { distance: number; steps: AlignmentStep[] } {
  const n = written.length;
  const m = expected.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) d[i][0] = d[i - 1][0] + indelCost(written[i - 1]);
  for (let j = 1; j <= m; j++) d[0][j] = d[0][j - 1] + indelCost(expected[j - 1]);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + indelCost(written[i - 1]),
        d[i][j - 1] + indelCost(expected[j - 1]),
        d[i - 1][j - 1] + substitutionCost(written[i - 1], expected[j - 1]),
      );
    }
  }

  const steps: AlignmentStep[] = [];
  let i = n;
  let j = m;
  const same = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      same(d[i][j], d[i - 1][j - 1] + substitutionCost(written[i - 1], expected[j - 1]))
    ) {
      const w = written[i - 1];
      const e = expected[j - 1];
      steps.push(
        w === e
          ? { op: 'match', expected: e, written: w }
          : { op: 'substituted', expected: e, written: w },
      );
      i--;
      j--;
    } else if (j > 0 && same(d[i][j], d[i][j - 1] + indelCost(expected[j - 1]))) {
      steps.push({ op: 'missing', expected: expected[j - 1] });
      j--;
    } else {
      steps.push({ op: 'extra', written: written[i - 1] });
      i--;
    }
  }
  return { distance: d[n][m], steps: steps.reverse() };
}
