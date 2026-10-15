import type {
  PhonemeMatch,
  PhonemeSearchOptions,
  PronSource,
  SpellingHit,
} from '../../shared/fonetica-api';
import { PronVariant, tokenize, toVariant } from './ipa';
import { osaDistance, phonemeAlignment, phonemeDistance } from './distance';
import { britfoneToLongman, parseLongmanPron } from './transcription';

/**
 * Índice local de palabras con su pronunciación. Arranca con Britfone (diccionario abierto
 * británico, ~16 000 palabras) y cada palabra que se consulta en Longman reemplaza su
 * transcripción por la de Longman. La búsqueda por fonemas necesita este índice local:
 * Longman sólo permite buscar por ortografía.
 */

interface Pron {
  display: string;
  variants: PronVariant[];
}

interface LexiconEntry {
  key: string;
  /** soundKey(key), precalculada porque se compara en cada tecla. */
  sound: string;
  word: string;
  source: PronSource;
  prons: Pron[];
}

/** Penalidad por marcar el acento principal en otra vocal (sólo si el alumno lo pide). */
const STRESS_PENALTY = 0.5;

export class Lexicon {
  private readonly entries = new Map<string, LexiconEntry>();

  get size(): number {
    return this.entries.size;
  }

  info(): { total: number; fromLdoce: number } {
    let fromLdoce = 0;
    for (const entry of this.entries.values()) if (entry.source === 'ldoce') fromLdoce++;
    return { total: this.entries.size, fromLdoce };
  }

  /** Formato Britfone: "WORD, f o n e m a s" o "WORD(2), ..." para pronunciaciones alternativas. */
  loadBritfone(csv: string): void {
    for (const line of csv.split(/\r?\n/)) {
      const comma = line.indexOf(',');
      if (comma <= 0) continue;
      const rawWord = line
        .slice(0, comma)
        .replace(/\(\d+\)$/, '')
        .replace(/_/g, ' ')
        .trim();
      const phonemes = line.slice(comma + 1).trim();
      if (!rawWord || !phonemes) continue;
      const word = rawWord === 'I' ? 'I' : rawWord.toLowerCase();
      const key = normalizeKey(word);
      const existing = this.entries.get(key);
      if (existing?.source === 'ldoce') continue;
      const display = britfoneToLongman(phonemes);
      const pron = toPron(display, toVariant(tokenize(display).tokens));
      if (existing) {
        if (!existing.prons.some((p) => p.display === display)) existing.prons.push(pron);
      } else {
        this.entries.set(key, {
          key,
          sound: soundKey(key),
          word,
          source: 'britfone',
          prons: [pron],
        });
      }
    }
  }

  /** Reemplaza (o agrega) la palabra con las transcripciones de Longman, que tienen prioridad. */
  upsertFromLdoce(headword: string, prons: readonly string[]): void {
    const parsed = [...new Set(prons)]
      .map((display) => ({ display, variants: parseLongmanPron(display) }))
      .filter((p) => p.variants.length > 0);
    if (parsed.length === 0) return;
    const key = normalizeKey(headword);
    this.entries.set(key, {
      key,
      sound: soundKey(key),
      word: headword,
      source: 'ldoce',
      prons: parsed,
    });
  }

  /** Pronunciaciones conocidas de una palabra (para mostrar algo si Longman no responde). */
  pronsOf(word: string): { prons: string[]; source: PronSource } | null {
    const entry = this.entries.get(normalizeKey(word));
    return entry ? { prons: entry.prons.map((p) => p.display), source: entry.source } : null;
  }

  searchSpelling(query: string, limit = 25): SpellingHit[] {
    const q = normalizeKey(query);
    if (!q) return [];
    const maxEdits = q.length <= 3 ? 1 : q.length <= 7 ? 2 : 3;
    const qSound = soundKey(q);
    const hits: SpellingHit[] = [];

    for (const entry of this.entries.values()) {
      const key = entry.key;
      let kind: SpellingHit['kind'] | null = null;
      let score = Infinity;
      if (key === q) {
        kind = 'exact';
        score = 0;
      } else if (key.startsWith(q)) {
        kind = 'prefix';
        score = 0.5 + Math.min(0.9, 0.05 * (key.length - q.length));
      } else {
        const edits = osaDistance(q, key, maxEdits);
        if (edits <= maxEdits) {
          kind = 'fuzzy';
          score = edits;
        }
        // Errores "por cómo suena" (fonetik → phonetic) que la distancia de letras no alcanza.
        if (qSound.length >= 3) {
          const allowed = qSound.length >= 5 ? 1 : 0;
          const soundEdits = osaDistance(qSound, entry.sound, allowed);
          if (soundEdits <= allowed) {
            // Clave idéntica: entre las de 1 y 2 letras cambiadas; con una diferencia, después de todas.
            const soundScore = 1.3 + soundEdits + 0.05 * Math.abs(key.length - q.length);
            if (soundScore < score) {
              kind = 'fuzzy';
              score = soundScore;
            }
          }
        }
      }
      if (kind) {
        hits.push({
          word: entry.word,
          prons: entry.prons.map((p) => p.display),
          source: entry.source,
          kind,
          score,
        });
      }
    }

    // A igual distancia gana el largo más parecido al tipeado: "watre" → water (letras invertidas) antes que ware.
    const lengthGap = (w: string) => Math.abs(w.length - q.length);
    return hits
      .sort(
        (a, b) =>
          a.score - b.score ||
          lengthGap(a.word) - lengthGap(b.word) ||
          a.word.length - b.word.length ||
          a.word.localeCompare(b.word),
      )
      .slice(0, limit);
  }

  searchPhonemes(written: readonly string[], options: PhonemeSearchOptions): PhonemeMatch[] {
    const input = toVariant(written);
    const n = input.segments.length;
    if (n === 0) return [];
    const limit = options.limit ?? 40;
    const maxDistance = Math.max(1.5, 0.6 * n);
    const useStress = options.useStress && input.stressedVowel !== null;

    const candidates: Array<{
      entry: LexiconEntry;
      pron: Pron;
      variant: PronVariant;
      distance: number;
      stressMismatch: boolean;
    }> = [];
    for (const entry of this.entries.values()) {
      let best: (typeof candidates)[number] | null = null;
      for (const pron of entry.prons) {
        for (const variant of pron.variants) {
          let distance = phonemeDistance(input.segments, variant.segments, maxDistance);
          if (!Number.isFinite(distance)) continue;
          const stressMismatch =
            useStress &&
            variant.stressedVowel !== null &&
            variant.stressedVowel !== input.stressedVowel;
          if (stressMismatch) distance += STRESS_PENALTY;
          if (distance <= maxDistance && (!best || distance < best.distance)) {
            best = { entry, pron, variant, distance, stressMismatch };
          }
        }
      }
      if (best) candidates.push(best);
    }

    candidates.sort(
      (a, b) =>
        a.distance - b.distance ||
        sourceRank(a.entry.source) - sourceRank(b.entry.source) ||
        Math.abs(a.variant.segments.length - n) - Math.abs(b.variant.segments.length - n) ||
        a.entry.word.length - b.entry.word.length ||
        a.entry.word.localeCompare(b.entry.word),
    );

    return candidates.slice(0, limit).map((c) => ({
      word: c.entry.word,
      pron: c.pron.display,
      source: c.entry.source,
      distance: Math.round(c.distance * 100) / 100,
      exact: c.distance === 0,
      stressMismatch: c.stressMismatch,
      alignment: phonemeAlignment(input.segments, c.variant.segments).steps,
    }));
  }
}

function toPron(display: string, variant: PronVariant): Pron {
  return { display, variants: variant.segments.length > 0 ? [variant] : [] };
}

function sourceRank(source: PronSource): number {
  return source === 'ldoce' ? 0 : 1;
}

export function normalizeKey(word: string): string {
  return word.trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ');
}

/**
 * Clave "de cómo suena" para la ortografía: unifica grafías que suenan igual y todas las vocales.
 * "phonetic" y "fonetik" dan la misma clave: fanatak.
 */
export function soundKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/^ps/, 's')
    .replace(/ph/g, 'f')
    .replace(/gh/g, '')
    .replace(/wh/g, 'w')
    .replace(/tch/g, 'ch')
    .replace(/dge/g, 'j')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/[aeiouy]+/g, 'a')
    .replace(/(.)\1+/g, '$1');
}
