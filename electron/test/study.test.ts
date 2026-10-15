import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { SentenceOptions } from '../../shared/fonetica-api';
import { exerciseSentence, GRAMMAR_EXERCISES } from '../../shared/study-data/grammar-exercises';
import { IRREGULAR_VERBS, verbPattern } from '../../shared/study-data/irregular-verbs';
import { DICTATION_LEVELS, MINIMAL_PAIRS } from '../../shared/study-data/phonetics-practice';
import { tokenize } from '../core/ipa';
import { Lexicon } from '../core/lexicon';
import { analyzeSentence } from '../core/sentence';
import { checkTranscription, inflections } from '../core/study-tools';

const ROOT = join(__dirname, '..', '..', '..');
const lexicon = new Lexicon();
lexicon.loadBritfone(
  readFileSync(join(ROOT, 'resources', 'britfone', 'britfone.main.3.0.1.csv'), 'utf8'),
);
const pronsOf = (w: string) => lexicon.pronsOf(w);
const connected: SentenceOptions = { connected: true, forcedStrong: [], forcedWeak: [] };
const analyze = (text: string) =>
  analyzeSentence(text, connected, { pronsOf, longmanForms: () => null });

describe('material de estudio', () => {
  it('cada palabra del dictado y de los pares mínimos tiene transcripción', () => {
    const words = [
      ...DICTATION_LEVELS.filter((l) => !l.phrases).flatMap((l) => l.items),
      ...MINIMAL_PAIRS.flatMap((s) => s.pairs.flat()),
    ];
    const missing = words.filter((w) => !lexicon.pronsOf(w));
    assert.deepEqual(missing, []);
  });

  it('cada forma de los verbos irregulares tiene transcripción (del diccionario o fija)', () => {
    const missing: string[] = [];
    for (const verb of IRREGULAR_VERBS) {
      for (const key of ['base', 'past', 'participle'] as const) {
        if (verb.prons?.[key]) continue;
        for (const form of verb[key].split(' / ')) if (!lexicon.pronsOf(form)) missing.push(form);
      }
    }
    assert.deepEqual(missing, []);
  });

  it('clasifica los verbos por patrón de formas', () => {
    const find = (base: string) => IRREGULAR_VERBS.find((v) => v.base === base)!;
    assert.equal(verbPattern(find('cut')), 'AAA');
    assert.equal(verbPattern(find('keep')), 'ABB');
    assert.equal(verbPattern(find('come')), 'ABA');
    assert.equal(verbPattern(find('go')), 'ABC');
    assert.equal(
      verbPattern(find('read')),
      'ABB',
      'read: misma ortografía, distinta pronunciación',
    );
  });

  it('los ejercicios tienen verbo y un patrón coherente con sus elementos y su sujeto', () => {
    for (const exercise of GRAMMAR_EXERCISES) {
      const roles = exercise.constituents.map((c) => c.role);
      const subject = exercise.subject ?? 'expreso';
      const name = exerciseSentence(exercise);
      assert.ok(roles.includes('V'), name);
      // Sujeto expreso: está entre los constituyentes; implícito o elíptico: no está.
      assert.equal(roles.includes('S'), subject === 'expreso', name);
      // Sólo las coordinadas con sujeto elíptico muestran la cláusula anterior como contexto.
      assert.equal(!!exercise.context, subject === 'elíptico', name);
      const required = exercise.pattern.slice(2); // lo que sigue a "SV"
      if (required.includes('O')) assert.ok(roles.includes('Od'), exercise.pattern);
      if (exercise.pattern === 'SVOO') assert.ok(roles.includes('Oi'));
      if (exercise.pattern.endsWith('C')) assert.ok(roles.includes('Cs') || roles.includes('Co'));
    }
  });
});

describe('dictado', () => {
  it('acepta la transcripción correcta (sin contar el acento) y marca los errores', () => {
    const right = checkTranscription(tokenize('ˈwɔːtə').tokens, 'ˈwɔːtə');
    assert.equal(right.exact, true);
    const wrong = checkTranscription(tokenize('wɔːtər').tokens, 'ˈwɔːtə');
    assert.equal(wrong.exact, false);
    assert.equal(wrong.alignment.at(-1)?.op, 'extra');
  });

  it('considera las variantes de Longman (sonidos opcionales y alternativas)', () => {
    assert.equal(checkTranscription(tokenize('ɡʌvmənt').tokens, 'ˈɡʌv(ə)mənt').exact, true);
    assert.equal(checkTranscription(tokenize('skedjuːl').tokens, 'ˈʃedjuːl, ˈske-').exact, true);
  });
});

describe('terminaciones -s y -ed', () => {
  it('aplica las tres reglas de -ed', () => {
    assert.equal(inflections('stop', pronsOf).ed?.ending, '/t/');
    assert.equal(inflections('play', pronsOf).ed?.ending, '/d/');
    assert.equal(inflections('want', pronsOf).ed?.ending, '/ɪd/');
  });

  it('aplica las tres reglas de -s y arma la ortografía', () => {
    const watch = inflections('watch', pronsOf).s;
    assert.equal(watch?.spelling, 'watches');
    assert.equal(watch?.ending, '/ɪz/');
    assert.equal(inflections('laugh', pronsOf).s?.ending, '/s/');
    assert.equal(inflections('study', pronsOf).s?.spelling, 'studies');
    assert.equal(inflections('love', pronsOf).s?.ending, '/z/');
  });
});

describe('procesos del habla conectada', () => {
  const process = (text: string) =>
    analyze(text).processes.map((p) => `${p.kind}: ${p.words} (${p.detail})`);

  it('asimilación de lugar', () => {
    assert.ok(
      process('Ten boys came.').some((p) => p.startsWith('assimilation: Ten boys (/n/ → /m/')),
    );
    assert.ok(
      process('Look at that cat.').some((p) => p.startsWith('assimilation: that cat (/t/ → /k/')),
    );
    assert.ok(
      process('This shop is open.').some((p) => p.startsWith('assimilation: This shop (/s/ → /ʃ/')),
    );
  });

  it('elisión de /t/ entre consonantes', () => {
    assert.ok(process('See you next day.').some((p) => p.startsWith('elision: next day')));
  });

  it('coalescencia con /j/', () => {
    const result = analyze("Don't you know?");
    assert.ok(result.processes.some((p) => p.kind === 'coalescence'));
    assert.match(result.connectedTranscription, /tʃu/);
  });

  it('r intrusiva y r de enlace', () => {
    assert.ok(process('The idea of it.').some((p) => p.startsWith('intrusive-r: idea of')));
    assert.ok(process('It is far away.').some((p) => p.startsWith('linking-r: far away')));
  });

  it('no aplica procesos sin habla conectada', () => {
    const result = analyzeSentence(
      'Ten boys came.',
      { connected: false, forcedStrong: [], forcedWeak: [] },
      { pronsOf, longmanForms: () => null },
    );
    assert.deepEqual(result.processes, []);
  });
});
