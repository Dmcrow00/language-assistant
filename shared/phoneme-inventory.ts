/**
 * Inventario fonémico del inglés británico RP en la notación de Longman (LDOCE).
 *
 * Longman sigue la tradición de Gimson, que es la que se enseña en los profesorados:
 * /e/ (no /ɛ/), /ʌ/ (no /ɐ/), /r/ (no /ɹ/), /eə/ (no /ɛː/). Las fuentes que usan IPA
 * estricta se convierten a esta notación antes de comparar (ver electron/core/ipa.ts).
 *
 * Este archivo es código compartido: lo usa el motor de búsqueda (proceso main de Electron)
 * para reconocer fonemas y el teclado en pantalla (Angular) para dibujar las teclas.
 */

export type PhonemeCategory = 'monophthong' | 'diphthong' | 'weak-vowel' | 'consonant';

export interface PhonemeInfo {
  symbol: string;
  category: PhonemeCategory;
  /** Conjunto léxico de Wells para las vocales (KIT, DRESS…); para las consonantes, su clase. */
  keyword: string;
  /** Palabra de ejemplo, la misma que trae la tabla fonémica de Underhill / British Council. */
  example: string;
  /** Sólo consonantes: sonora o sorda (la tabla las muestra de a pares). */
  voiced?: boolean;
}

export const PRIMARY_STRESS = 'ˈ';
export const SECONDARY_STRESS = 'ˌ';
export const LENGTH_MARK = 'ː';

export const PHONEMES: readonly PhonemeInfo[] = [
  // Monoptongos
  { symbol: 'iː', category: 'monophthong', keyword: 'FLEECE', example: 'sheep' },
  { symbol: 'ɪ', category: 'monophthong', keyword: 'KIT', example: 'ship' },
  { symbol: 'ʊ', category: 'monophthong', keyword: 'FOOT', example: 'good' },
  { symbol: 'uː', category: 'monophthong', keyword: 'GOOSE', example: 'shoot' },
  { symbol: 'e', category: 'monophthong', keyword: 'DRESS', example: 'bed' },
  { symbol: 'ə', category: 'monophthong', keyword: 'COMMA', example: 'teacher' },
  { symbol: 'ɜː', category: 'monophthong', keyword: 'NURSE', example: 'bird' },
  { symbol: 'ɔː', category: 'monophthong', keyword: 'THOUGHT', example: 'door' },
  { symbol: 'æ', category: 'monophthong', keyword: 'TRAP', example: 'cat' },
  { symbol: 'ʌ', category: 'monophthong', keyword: 'STRUT', example: 'up' },
  { symbol: 'ɑː', category: 'monophthong', keyword: 'PALM', example: 'far' },
  { symbol: 'ɒ', category: 'monophthong', keyword: 'LOT', example: 'on' },
  // Diptongos
  { symbol: 'ɪə', category: 'diphthong', keyword: 'NEAR', example: 'here' },
  { symbol: 'eɪ', category: 'diphthong', keyword: 'FACE', example: 'wait' },
  { symbol: 'ʊə', category: 'diphthong', keyword: 'CURE', example: 'tourist' },
  { symbol: 'ɔɪ', category: 'diphthong', keyword: 'CHOICE', example: 'boy' },
  { symbol: 'əʊ', category: 'diphthong', keyword: 'GOAT', example: 'show' },
  { symbol: 'eə', category: 'diphthong', keyword: 'SQUARE', example: 'hair' },
  { symbol: 'aɪ', category: 'diphthong', keyword: 'PRICE', example: 'my' },
  { symbol: 'aʊ', category: 'diphthong', keyword: 'MOUTH', example: 'cow' },
  // Vocales débiles que Longman distingue (happY, thankYOU)
  { symbol: 'i', category: 'weak-vowel', keyword: 'happY', example: 'happy' },
  { symbol: 'u', category: 'weak-vowel', keyword: 'thankYOU', example: 'situation' },
  // Consonantes, en el orden de la tabla (pares sorda/sonora)
  { symbol: 'p', category: 'consonant', keyword: 'plosiva', example: 'pea', voiced: false },
  { symbol: 'b', category: 'consonant', keyword: 'plosiva', example: 'boat', voiced: true },
  { symbol: 't', category: 'consonant', keyword: 'plosiva', example: 'tea', voiced: false },
  { symbol: 'd', category: 'consonant', keyword: 'plosiva', example: 'dog', voiced: true },
  { symbol: 'tʃ', category: 'consonant', keyword: 'africada', example: 'cheese', voiced: false },
  { symbol: 'dʒ', category: 'consonant', keyword: 'africada', example: 'June', voiced: true },
  { symbol: 'k', category: 'consonant', keyword: 'plosiva', example: 'car', voiced: false },
  { symbol: 'ɡ', category: 'consonant', keyword: 'plosiva', example: 'go', voiced: true },
  { symbol: 'f', category: 'consonant', keyword: 'fricativa', example: 'fly', voiced: false },
  { symbol: 'v', category: 'consonant', keyword: 'fricativa', example: 'video', voiced: true },
  { symbol: 'θ', category: 'consonant', keyword: 'fricativa', example: 'think', voiced: false },
  { symbol: 'ð', category: 'consonant', keyword: 'fricativa', example: 'this', voiced: true },
  { symbol: 's', category: 'consonant', keyword: 'fricativa', example: 'see', voiced: false },
  { symbol: 'z', category: 'consonant', keyword: 'fricativa', example: 'zoo', voiced: true },
  { symbol: 'ʃ', category: 'consonant', keyword: 'fricativa', example: 'shall', voiced: false },
  { symbol: 'ʒ', category: 'consonant', keyword: 'fricativa', example: 'television', voiced: true },
  { symbol: 'm', category: 'consonant', keyword: 'nasal', example: 'man', voiced: true },
  { symbol: 'n', category: 'consonant', keyword: 'nasal', example: 'now', voiced: true },
  { symbol: 'ŋ', category: 'consonant', keyword: 'nasal', example: 'sing', voiced: true },
  { symbol: 'h', category: 'consonant', keyword: 'fricativa', example: 'hat', voiced: false },
  {
    symbol: 'l',
    category: 'consonant',
    keyword: 'aproximante lateral',
    example: 'love',
    voiced: true,
  },
  { symbol: 'r', category: 'consonant', keyword: 'aproximante', example: 'red', voiced: true },
  { symbol: 'w', category: 'consonant', keyword: 'aproximante', example: 'wet', voiced: true },
  { symbol: 'j', category: 'consonant', keyword: 'aproximante', example: 'yes', voiced: true },
];

const VOWEL_SYMBOLS = new Set(
  PHONEMES.filter((p) => p.category !== 'consonant').map((p) => p.symbol),
);

export function isVowel(symbol: string): boolean {
  return VOWEL_SYMBOLS.has(symbol);
}

export function phonemeInfo(symbol: string): PhonemeInfo | undefined {
  return PHONEMES.find((p) => p.symbol === symbol);
}

const SYMBOLS_LONGEST_FIRST = PHONEMES.map((p) => p.symbol).sort((a, b) => b.length - a.length);

/**
 * Los fonemas distintos de una transcripción en notación Longman, en el orden en que aparecen
 * (sólo la primera variante si hay varias separadas por coma). Sirve para explicar los sonidos
 * de una palabra uno por uno; los acentos y los símbolos desconocidos se ignoran.
 */
export function phonemesOf(pron: string): string[] {
  const text = pron
    .split(',')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/g/g, 'ɡ')
    .replace(/:/g, LENGTH_MARK);
  const found: string[] = [];
  let i = 0;
  while (i < text.length) {
    const symbol = SYMBOLS_LONGEST_FIRST.find((s) => text.startsWith(s, i));
    if (symbol) {
      if (!found.includes(symbol)) found.push(symbol);
      i += symbol.length;
    } else {
      i++;
    }
  }
  return found;
}
