import type { ConnectedProcess, SentenceWord } from '../../shared/fonetica-api';
import { isVowel } from '../../shared/phoneme-inventory';
import { tokenize } from './ipa';

/**
 * Procesos del habla conectada entre palabras (Roach, cap. 14), todos optativos en RP:
 *
 * - r de enlace (far‿away) y r intrusiva (law and order /lɔːr ənd/).
 * - Elisión de /t/ y /d/ entre consonantes: next day /neks deɪ/.
 * - Asimilación de lugar de /t d n/ final: ten boys /tem bɔɪz/, that cat /ðæk kæt/;
 *   y de /s z/ ante /ʃ/: this shop /ðɪʃ ʃɒp/.
 * - Coalescencia con /j/: don't you /dəʊntʃu/, would you /wʊdʒu/.
 *
 * Marca cada proceso y deja en `connectedPron` la transcripción con el proceso aplicado.
 */

const R_VOWELS = new Set(['ə', 'ɑː', 'ɔː', 'ɜː', 'ɪə', 'eə', 'ʊə']);
const BILABIAL = new Set(['p', 'b', 'm']);
const VELAR = new Set(['k', 'ɡ']);
const TO_BILABIAL: Readonly<Record<string, string>> = { t: 'p', d: 'b', n: 'm' };
const TO_VELAR: Readonly<Record<string, string>> = { t: 'k', d: 'ɡ', n: 'ŋ' };
const COALESCENCE: Readonly<Record<string, string>> = { t: 'tʃ', d: 'dʒ', s: 'ʃ', z: 'ʒ' };

function phonemes(pron: string): string[] {
  return tokenize(pron).tokens.filter((t) => t !== 'ˈ' && t !== 'ˌ');
}

/** Reemplaza el último fonema de la transcripción (respetando acentos y paréntesis previos). */
function replaceLast(pron: string, from: string, to: string): string {
  const at = pron.lastIndexOf(from);
  return at < 0 ? pron : pron.slice(0, at) + to + pron.slice(at + from.length);
}

/** Reemplaza el primer fonema (después de una posible marca de acento). */
function replaceFirst(pron: string, from: string, to: string): string {
  const offset = /^[ˈˌ]/.test(pron) ? 1 : 0;
  return pron.startsWith(from, offset)
    ? pron.slice(0, offset) + to + pron.slice(offset + from.length)
    : pron;
}

export function detectProcesses(words: SentenceWord[]): ConnectedProcess[] {
  const processes: ConnectedProcess[] = [];
  const current = words.map((w) => (w.pron ? w.pron + (w.linkingR ? 'r' : '') : null));

  words.forEach((word, i) => {
    const next = words[i + 1];
    const pron = current[i];
    const nextPron = next ? current[i + 1] : null;
    if (!next || word.pauseAfter || !pron || !nextPron) return;
    const a = phonemes(pron);
    const b = phonemes(nextPron);
    const last = a[a.length - 1];
    const beforeLast = a[a.length - 2];
    const first = b[0];
    const add = (kind: ConnectedProcess['kind'], label: string, detail: string) =>
      processes.push({ kind, wordIndex: i, label, detail, words: `${word.text} ${next.text}` });

    if (word.linkingR) {
      add('linking-r', 'r de enlace', 'la r escrita se pronuncia porque sigue una vocal');
      return;
    }
    if (isVowel(first) && R_VOWELS.has(last) && !/r(e)?$/i.test(word.text)) {
      current[i] = pron + 'r';
      add(
        'intrusive-r',
        'r intrusiva',
        `/r/ entre /${last}/ y vocal, aunque no hay r escrita (frecuente en RP, considerada informal)`,
      );
      return;
    }
    if (
      (last === 't' || last === 'd') &&
      beforeLast &&
      !isVowel(beforeLast) &&
      !isVowel(first) &&
      first !== 'j' &&
      first !== 'h'
    ) {
      current[i] = replaceLast(pron, last, '');
      add('elision', 'elisión', `se pierde /${last}/ entre consonantes`);
      return;
    }
    if (first === 'j' && COALESCENCE[last]) {
      current[i] = replaceLast(pron, last, '');
      current[i + 1] = replaceFirst(nextPron, 'j', COALESCENCE[last]);
      add('coalescence', 'coalescencia', `/${last}/ + /j/ se funden en /${COALESCENCE[last]}/`);
      return;
    }
    const target = BILABIAL.has(first)
      ? TO_BILABIAL[last]
      : VELAR.has(first)
        ? TO_VELAR[last]
        : undefined;
    if (target) {
      current[i] = replaceLast(pron, last, target);
      add('assimilation', 'asimilación', `/${last}/ → /${target}/ ante /${first}/`);
      return;
    }
    if ((last === 's' || last === 'z') && first === 'ʃ') {
      const to = last === 's' ? 'ʃ' : 'ʒ';
      current[i] = replaceLast(pron, last, to);
      add('assimilation', 'asimilación', `/${last}/ → /${to}/ ante /ʃ/`);
    }
  });

  words.forEach((word, i) => {
    const original = word.pron ? word.pron + (word.linkingR ? 'r' : '') : null;
    if (current[i] !== original && current[i] !== null) word.connectedPron = current[i]!;
  });
  return processes;
}
