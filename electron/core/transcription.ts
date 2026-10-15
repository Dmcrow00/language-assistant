import { isVowel, PRIMARY_STRESS, SECONDARY_STRESS } from '../../shared/phoneme-inventory';
import { normalizeIpa, PronVariant, tokenize, toVariant, variantKey } from './ipa';

/**
 * Transcripciones de Longman → variantes comparables.
 *
 * Longman escribe varias pronunciaciones separadas por coma y abrevia las alternativas:
 *   "ˈʃedjuːl, ˈske-"       → la segunda reemplaza el comienzo: ˈskedjuːl
 *   "ˈskedʒʊl, -dʒ(ə)l"     → la segunda reemplaza el final:    ˈskedʒəl
 * Los sonidos opcionales (en cursiva en Longman) los guardamos entre paréntesis: ˈɡʌv(ə)mənt.
 */

/** Expande las abreviaturas con guion; devuelve transcripciones completas, todavía con paréntesis. */
export function expandLongmanAlternatives(pron: string): string[] {
  const parts = pron
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return [];
  const base = parts[0].replace(/-$/, '');
  const result = [base];
  for (const part of parts.slice(1)) {
    const expanded = expandPartial(base, part);
    if (expanded && !result.includes(expanded)) result.push(expanded);
  }
  return result;
}

function expandPartial(base: string, part: string): string | null {
  if (part.endsWith('-') && !part.startsWith('-')) {
    // Reemplaza el comienzo: se engancha en la primera aparición del último símbolo de la parte.
    const head = part.slice(0, -1);
    const anchor = lastSoundChar(head);
    if (!anchor) return null;
    const at = base.indexOf(anchor);
    return at < 0 ? null : head + base.slice(at + anchor.length);
  }
  if (part.startsWith('-') && !part.endsWith('-')) {
    // Reemplaza el final: se engancha en la última aparición del primer símbolo de la parte.
    const tail = part.slice(1);
    const anchor = firstSoundChar(tail);
    if (!anchor) return null;
    const at = base.lastIndexOf(anchor);
    return at < 0 ? null : base.slice(0, at) + tail;
  }
  if (part.includes('-')) return null; // abreviatura en el medio: no la interpretamos
  return part;
}

function firstSoundChar(text: string): string | undefined {
  return [...text].find((c) => !'ˈˌ()'.includes(c));
}

function lastSoundChar(text: string): string | undefined {
  return [...text].reverse().find((c) => !'ˈˌ()ː'.includes(c));
}

/** "ˈɡʌv(ə)mənt" → ["ˈɡʌvəmənt", "ˈɡʌvmənt"]. Como mucho 3 sonidos opcionales (8 combinaciones). */
export function expandOptionalSounds(pron: string): string[] {
  const pieces = pron.split(/(\([^)]*\))/).filter((p) => p !== '');
  let results = [''];
  let optionalCount = 0;
  for (const piece of pieces) {
    const optional = piece.startsWith('(') && piece.endsWith(')');
    if (optional && optionalCount < 3) {
      optionalCount++;
      const inner = piece.slice(1, -1);
      results = results.flatMap((r) => [r + inner, r]);
    } else {
      const text = optional ? piece.slice(1, -1) : piece;
      results = results.map((r) => r + text);
    }
  }
  return results;
}

/** Todas las variantes comparables de una transcripción de Longman, sin repetidos. */
export function parseLongmanPron(pron: string): PronVariant[] {
  const variants: PronVariant[] = [];
  const seen = new Set<string>();
  for (const full of expandLongmanAlternatives(pron)) {
    for (const plain of expandOptionalSounds(full)) {
      const variant = toVariant(tokenize(plain).tokens);
      const key = variantKey(variant);
      if (variant.segments.length > 0 && !seen.has(key)) {
        seen.add(key);
        variants.push(variant);
      }
    }
  }
  return variants;
}

/**
 * Grupos de consonantes que pueden iniciar sílaba en inglés. Se usan para correr la marca
 * de acento de Britfone (pegada a la vocal) al comienzo de la sílaba, como en Longman:
 * Britfone "k ə m p j ˈuː t ə" → Longman "kəmˈpjuːtə".
 */
const LEGAL_ONSETS = new Set(
  [
    'pl pr pj bl br bj tr tj tw dr dj dw kl kr kj kw ɡl ɡr ɡj ɡw',
    'fl fr fj vj θr θj θw ʃr sp st sk sm sn sl sw sf sj mj nj lj hj',
    'spl spr spj str stj skr skw skj',
  ]
    .join(' ')
    .split(' '),
);

function isLegalOnset(cluster: readonly string[]): boolean {
  if (cluster.length === 0) return true;
  if (cluster.length === 1) return cluster[0] !== 'ŋ';
  return LEGAL_ONSETS.has(cluster.join(''));
}

/**
 * Convierte una pronunciación de Britfone (fonemas separados por espacio, IPA estricta,
 * acento pegado a la vocal) a una cadena en notación Longman.
 */
export function britfoneToLongman(spaceSeparated: string): string {
  const units: string[] = [];
  const stressBefore = new Map<number, string>(); // índice de vocal en `units` → marca
  for (const raw of spaceSeparated.trim().split(/\s+/)) {
    let token = normalizeIpa(raw);
    let mark: string | undefined;
    if (token.startsWith(PRIMARY_STRESS) || token.startsWith(SECONDARY_STRESS)) {
      mark = token[0];
      token = token.slice(1);
    }
    if (token === '') continue;
    if (mark) stressBefore.set(units.length, mark);
    units.push(token);
  }

  // Para cada vocal acentuada, la marca va antes del grupo consonántico más largo que pueda iniciar sílaba.
  const marksAt = new Map<number, string>();
  for (const [vowelIndex, mark] of stressBefore) {
    let start = vowelIndex;
    while (start > 0 && !isVowel(units[start - 1])) start--;
    let onsetStart = start === 0 ? 0 : vowelIndex;
    if (start > 0) {
      for (let s = start; s <= vowelIndex; s++) {
        if (isLegalOnset(units.slice(s, vowelIndex))) {
          onsetStart = s;
          break;
        }
      }
    }
    marksAt.set(onsetStart, mark);
  }

  // Como Longman, los monosílabos van sin marca de acento: "kæt", no "ˈkæt".
  if (units.filter((u) => isVowel(u)).length === 1) marksAt.clear();

  return units.map((u, i) => (marksAt.get(i) ?? '') + u).join('');
}
