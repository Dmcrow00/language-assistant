import {
  isVowel,
  PHONEMES,
  PRIMARY_STRESS,
  SECONDARY_STRESS,
} from '../../shared/phoneme-inventory';

/**
 * Una pronunciación lista para comparar: la secuencia de fonemas sin marcas de acento
 * y el número de vocal (0, 1, 2…) que lleva el acento principal.
 *
 * Guardamos el acento como "qué vocal" y no como posición de la marca porque cada fuente
 * la pone en un lugar distinto (Longman antes de la sílaba, Britfone pegada a la vocal).
 */
export interface PronVariant {
  segments: string[];
  stressedVowel: number | null;
}

/** Equivalencias de notación: IPA estricta (Britfone, eSpeak) y tipeo ASCII → notación Longman. */
const EQUIVALENTS: ReadonlyArray<[string, string]> = [
  ['ɛ', 'e'],
  ['ɐ', 'ʌ'],
  ['ɹ', 'r'],
  ['g', 'ɡ'],
  ['ɝ', 'ɜː'],
  ['ɚ', 'ə'],
  ['ʧ', 'tʃ'],
  ['ʤ', 'dʒ'],
  ['ɫ', 'l'],
  [':', 'ː'],
  ["'", PRIMARY_STRESS],
  ['ʳ', ''], // r de enlace: no se pronuncia en RP salvo ante vocal
];

/** Caracteres que separan pero no son sonidos: espacios, separación silábica, barras. */
const IGNORED = new Set([' ', '.', '-', '/', '‿', '‧', '\u00a0']);

const SYMBOLS_LONGEST_FIRST = [
  ...PHONEMES.map((p) => p.symbol),
  PRIMARY_STRESS,
  SECONDARY_STRESS,
].sort((a, b) => b.length - a.length);

export function normalizeIpa(text: string): string {
  // NFD separa los diacríticos combinados (p. ej. la marca de consonante silábica) para poder descartarlos.
  let result = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [from, to] of EQUIVALENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

/**
 * Parte una transcripción en fonemas tomando siempre el símbolo más largo posible,
 * así "aɪ" es un diptongo y no "a" + "ɪ", y "tʃ" es una africada.
 */
export function tokenize(text: string): { tokens: string[]; unknown: string[] } {
  const normalized = normalizeIpa(text);
  const tokens: string[] = [];
  const unknown: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (IGNORED.has(char)) {
      i++;
      continue;
    }
    const symbol = SYMBOLS_LONGEST_FIRST.find((s) => normalized.startsWith(s, i));
    if (symbol) {
      tokens.push(symbol);
      i += symbol.length;
    } else {
      unknown.push(char);
      i++;
    }
  }
  return { tokens, unknown };
}

/** Saca las marcas de acento y anota qué vocal lleva el principal. */
export function toVariant(tokens: readonly string[]): PronVariant {
  const segments: string[] = [];
  let vowelCount = 0;
  let pendingPrimary = false;
  let stressedVowel: number | null = null;
  for (const token of tokens) {
    if (token === PRIMARY_STRESS) {
      pendingPrimary = true;
      continue;
    }
    if (token === SECONDARY_STRESS) continue;
    if (isVowel(token)) {
      if (pendingPrimary && stressedVowel === null) stressedVowel = vowelCount;
      pendingPrimary = false;
      vowelCount++;
    }
    segments.push(token);
  }
  return { segments, stressedVowel };
}

export function variantKey(variant: PronVariant): string {
  return variant.segments.join(' ');
}
