import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { LdoceLookup, SentenceOptions } from '../../shared/fonetica-api';
import { Lexicon } from '../core/lexicon';
import {
  analyzeSentence,
  longmanFormsFromLookup,
  SentenceDeps,
  tokenizeSentence,
} from '../core/sentence';
import { parseEntryPage } from '../ldoce/ldoce-parser';

const BRITFONE = join(
  __dirname,
  '..',
  '..',
  '..',
  'resources',
  'britfone',
  'britfone.main.3.0.1.csv',
);
const lexicon = new Lexicon();
lexicon.loadBritfone(readFileSync(BRITFONE, 'utf8'));

const localOnly: SentenceDeps = { pronsOf: (w) => lexicon.pronsOf(w), longmanForms: () => null };
const connected: SentenceOptions = { connected: true, forcedStrong: [], forcedWeak: [] };

function analyze(text: string, options = connected, deps = localOnly) {
  return analyzeSentence(text, options, deps);
}

function word(text: string, sentence: string, options = connected, occurrence = 0) {
  const words = analyze(sentence, options).words.filter((w) => w.key === text);
  return words[occurrence];
}

describe('separación de la oración', () => {
  it('reconoce palabras, contracciones, pausas y preguntas', () => {
    const tokens = tokenizeSentence("Where are you from? I'm fine, thanks.");
    assert.deepEqual(
      tokens.map((t) => t.text),
      ['Where', 'are', 'you', 'from', "I'm", 'fine', 'thanks'],
    );
    assert.deepEqual(
      tokens.map((t) => t.pauseAfter ?? ''),
      ['', '', '', '||', '', '|', '||'],
    );
    assert.deepEqual(
      tokens.map((t) => t.sentenceInitial),
      [true, false, false, false, true, false, false],
    );
    assert.equal(tokens[0].question, true);
    assert.equal(tokens[5].question, false);
  });
});

describe('function words: forma débil y fuerte', () => {
  it('"the" es débil /ðə/ ante consonante y /ði/ ante vocal', () => {
    assert.equal(word('the', 'The cat sat on the mat.').pron, 'ðə');
    const beforeVowel = word('the', 'I ate the apple.');
    assert.equal(beforeVowel.pron, 'ði');
    assert.equal(beforeVowel.functionWord?.form, 'weak');
  });

  it('al final de la oración va fuerte, salvo los pronombres', () => {
    const from = word('from', 'Where are you from?');
    assert.equal(from.functionWord?.form, 'strong');
    assert.equal(from.pron, 'frɒm');
    assert.equal(word('are', 'Where are you from?').pron, 'ə');
    const her = word('her', 'I gave it to her.');
    assert.equal(her.functionWord?.form, 'weak');
    assert.equal(her.pron, 'ə', 'sin /h/ en el medio de la oración');
  });

  it('"to" ante vocal (incluida la "her" sin /h/) pasa a /tʊ/', () => {
    assert.equal(word('to', 'I gave it to her.').pron, 'tʊ');
    assert.equal(word('to', 'I want to go.').pron, 'tə');
  });

  it('la /h/ se pronuncia al comienzo de la oración', () => {
    assert.equal(word('her', 'Her car is red.').pron, 'hə');
  });

  it('"there" existencial es débil (con r de enlace) y de lugar es fuerte', () => {
    const first = word('there', 'There is a book over there.');
    assert.equal(first.functionWord?.form, 'weak');
    assert.equal(first.pron, 'ðə');
    assert.equal(first.linkingR, true);
    assert.equal(word('there', 'There is a book over there.', connected, 1).pron, 'ðeə');
  });

  it('"have" auxiliar es débil y como verbo principal es fuerte', () => {
    assert.equal(word('have', 'I have seen it.').pron, 'əv');
    assert.equal(word('have', 'I have a car.').functionWord?.form, 'strong');
  });

  it('el alumno puede marcar una palabra como enfatizada', () => {
    const sentence = 'I want to go.';
    const index = analyze(sentence).words.findIndex((w) => w.key === 'to');
    const forced = word('to', sentence, { connected: true, forcedStrong: [index], forcedWeak: [] });
    assert.equal(forced.pron, 'tuː');
    assert.equal(forced.functionWord?.forced, true);
  });

  it('y también sin énfasis, para corregir los casos ambiguos (that conjunción)', () => {
    const sentence = 'I know that.';
    assert.equal(word('that', sentence).pron, 'ðæt');
    const index = analyze(sentence).words.findIndex((w) => w.key === 'that');
    assert.equal(
      word('that', sentence, { connected: true, forcedStrong: [], forcedWeak: [index] }).pron,
      'ðət',
    );
  });

  it('sin habla conectada todo va en forma de cita y sin r de enlace', () => {
    const result = analyze('There is a lot of water in it.', {
      connected: false,
      forcedStrong: [],
      forcedWeak: [],
    });
    assert.ok(
      result.words.filter((w) => w.functionWord).every((w) => w.functionWord?.form === 'strong'),
    );
    assert.ok(result.words.every((w) => !w.linkingR));
  });
});

describe('habla conectada y palabras derivadas', () => {
  it('agrega la r de enlace entre vocales (far away)', () => {
    const result = analyze('It is far away.');
    assert.equal(result.words.find((w) => w.key === 'far')?.linkingR, true);
    assert.match(result.transcription, /fɑːr /);
  });

  it('marca las pausas en la transcripción', () => {
    assert.match(analyze('Yes, I can. Thanks.').transcription, / \| .* \|\| /);
  });

  it('arma palabras que no están en el diccionario a partir de la base', () => {
    const watered = word('watered', 'I watered the plants.');
    assert.equal(watered.source, 'derived');
    assert.equal(watered.pron, 'ˈwɔːtəd');
    assert.equal(word('watering', 'She is watering them.').pron, 'ˈwɔːtərɪŋ');
  });
});

describe('formas de Longman', () => {
  const page = `<span class="ldoceEntry Entry"><span class="Head"><span class="HWD">the</span>
    <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">ðə</span><span class="STRONG"><span class="neutral span">; </span>before vowels</span><span class="PRON"> ði</span><span class="STRONG"><span class="neutral span">; </span>strong</span><span class="PRON"> ðiː</span><span class="neutral span">/</span></span>
    <span class="POS"> definite article</span></span></span>`;

  it('el parser separa las formas etiquetadas', () => {
    const [entry] = parseEntryPage(page);
    assert.equal(entry.pronBrE, 'ðə');
    assert.deepEqual(entry.pronFormsBrE, [
      { pron: 'ðə' },
      { label: 'before vowels', pron: 'ði' },
      { label: 'strong', pron: 'ðiː' },
    ]);
  });

  it('las formas que siguen a la variante americana ($) no se mezclan con las británicas', () => {
    const forPage = `<span class="ldoceEntry Entry"><span class="Head"><span class="HWD">for</span>
      <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">fə</span><span class="STRONG"><span class="neutral span">; </span>strong</span><span class="PRON"> fɔː</span><span class="AMEVARPRON"><span class="neutral span"> $ </span>fər</span><span class="STRONG"> strong</span><span class="PRON"> fɔːr</span><span class="neutral span">/</span></span>
      <span class="POS"> preposition</span></span></span>`;
    const [entry] = parseEntryPage(forPage);
    assert.deepEqual(entry.pronFormsBrE, [{ pron: 'fə' }, { label: 'strong', pron: 'fɔː' }]);
    assert.equal(entry.pronAmE, 'fər');
  });

  it('cuando Longman ya respondió, sus formas reemplazan a la tabla', () => {
    const lookup: LdoceLookup = {
      query: 'the',
      status: 'found',
      entries: parseEntryPage(page),
      suggestions: [],
      fromCache: true,
    };
    const forms = longmanFormsFromLookup(lookup);
    assert.deepEqual(forms, {
      category: 'artículo',
      weak: ['ðə'],
      weakBeforeVowel: 'ði',
      strong: 'ðiː',
    });
    const deps: SentenceDeps = { ...localOnly, longmanForms: (w) => (w === 'the' ? forms : null) };
    const the = analyze('The end.', connected, deps).words[0];
    assert.equal(the.source, 'ldoce');
    assert.equal(the.functionWord?.fromLongman, true);
    assert.equal(the.pron, 'ði');
  });
});
