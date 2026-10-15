import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { tokenize, toVariant } from '../core/ipa';
import { phonemeAlignment, phonemeDistance } from '../core/distance';
import { Lexicon, soundKey } from '../core/lexicon';
import {
  britfoneToLongman,
  expandLongmanAlternatives,
  expandOptionalSounds,
  parseLongmanPron,
} from '../core/transcription';

const BRITFONE = join(
  __dirname,
  '..',
  '..',
  '..',
  'resources',
  'britfone',
  'britfone.main.3.0.1.csv',
);

describe('tokenize', () => {
  it('reconoce diptongos, africadas y vocales largas como un solo fonema', () => {
    assert.deepEqual(tokenize('ˈtʃaɪəˈθiːə').tokens, ['ˈ', 'tʃ', 'aɪ', 'ə', 'ˈ', 'θ', 'iː', 'ə']);
  });

  it('pasa la IPA estricta y el tipeo ASCII a la notación de Longman', () => {
    assert.deepEqual(tokenize("ɹ'ɛd").tokens, ['r', 'ˈ', 'e', 'd']);
    assert.deepEqual(tokenize('fɑ:').tokens, ['f', 'ɑː']);
  });

  it('anota qué vocal lleva el acento principal', () => {
    assert.deepEqual(toVariant(tokenize('kəmˈpjuːtə').tokens), {
      segments: ['k', 'ə', 'm', 'p', 'j', 'uː', 't', 'ə'],
      stressedVowel: 1,
    });
  });
});

describe('transcripciones de Longman', () => {
  it('expande las alternativas abreviadas con guion', () => {
    assert.deepEqual(expandLongmanAlternatives('ˈʃedjuːl, ˈske-'), ['ˈʃedjuːl', 'ˈskedjuːl']);
    assert.deepEqual(expandLongmanAlternatives('ˈkʌmftəb(ə)l, ˈkʌmfət-'), [
      'ˈkʌmftəb(ə)l',
      'ˈkʌmfətəb(ə)l',
    ]);
    assert.deepEqual(expandLongmanAlternatives('ˈskedʒʊl, -dʒ(ə)l'), ['ˈskedʒʊl', 'ˈskedʒ(ə)l']);
  });

  it('genera las versiones con y sin sonidos opcionales', () => {
    assert.deepEqual(expandOptionalSounds('ˈɡʌv(ə)mənt'), ['ˈɡʌvəmənt', 'ˈɡʌvmənt']);
    assert.equal(parseLongmanPron('ˈɡʌv(ə)mənt, ˈɡʌv(ə)nmənt').length, 4);
  });
});

describe('Britfone → Longman', () => {
  it('corre el acento al comienzo de la sílaba y cambia los símbolos', () => {
    assert.equal(britfoneToLongman('k ə m p j ˈuː t ə'), 'kəmˈpjuːtə');
    assert.equal(britfoneToLongman('w ˈɔː t ə'), 'ˈwɔːtə');
    assert.equal(
      britfoneToLongman('ɹ ˈɛ d'),
      'red',
      'los monosílabos van sin marca, como en Longman',
    );
    assert.equal(britfoneToLongman('ɐ n d ə s t ˈæ n d'), 'ʌndəˈstænd');
    assert.equal(britfoneToLongman('ɪ k s t ɹ ˈiː m'), 'ɪkˈstriːm');
  });
});

describe('distancia entre fonemas', () => {
  const p = (ipa: string) => toVariant(tokenize(ipa).tokens).segments;

  it('es 0 para la misma secuencia y chica para vocales vecinas', () => {
    assert.equal(phonemeDistance(p('kæt'), p('kæt')), 0);
    assert.ok(phonemeDistance(p('ʃɪp'), p('ʃiːp')) < phonemeDistance(p('ʃɪp'), p('ʃɑːp')));
  });

  it('una /r/ agregada cuesta poco (water → /wɔːtər/)', () => {
    assert.ok(phonemeDistance(p('wɔːtər'), p('wɔːtə')) <= 0.5);
  });

  it('explica qué fonemas no coinciden', () => {
    const { steps } = phonemeAlignment(p('ket'), p('kæt'));
    assert.deepEqual(
      steps.map((s) => s.op),
      ['match', 'substituted', 'match'],
    );
    assert.deepEqual(steps[1], { op: 'substituted', expected: 'æ', written: 'e' });
    assert.deepEqual(
      phonemeAlignment(p('kæts'), p('kæt')).steps.map((s) => s.op),
      ['match', 'match', 'match', 'extra'],
    );
    assert.equal(phonemeAlignment(p('ʃip'), p('ʃiːp')).steps[1].op, 'substituted');
  });
});

describe('Lexicon con Britfone', () => {
  const lexicon = new Lexicon();
  lexicon.loadBritfone(readFileSync(BRITFONE, 'utf8'));

  it('carga más de 15 000 palabras', () => {
    assert.ok(lexicon.size > 15000, `size = ${lexicon.size}`);
  });

  it('corrige errores de tipeo', () => {
    assert.equal(lexicon.searchSpelling('watre')[0].word, 'water');
    assert.equal(lexicon.searchSpelling('recieve')[0].word, 'receive');
    assert.equal(lexicon.searchSpelling('water')[0].kind, 'exact');
  });

  it('una palabra que sólo "suena parecido" no le gana a una con menos letras cambiadas', () => {
    const words = lexicon.searchSpelling('watered').map((h) => h.word);
    assert.ok(words.indexOf('waters') < words.indexOf('retired'), words.slice(0, 8).join(', '));
  });

  it('encuentra palabras escritas "como suenan"', () => {
    assert.equal(soundKey('phonetic'), soundKey('fonetik'));
    assert.ok(lexicon.searchSpelling('fonetik').some((h) => h.word === 'phonetic'));
  });

  it('encuentra homófonos por fonemas', () => {
    const words = lexicon
      .searchPhonemes(tokenize('nəʊ').tokens, { useStress: false })
      .filter((m) => m.exact)
      .map((m) => m.word);
    assert.ok(words.includes('know') && words.includes('no'), words.join(', '));
  });

  it('ubica la palabra aunque el alumno se equivoque en un fonema', () => {
    const top = lexicon
      .searchPhonemes(tokenize('ˈwɔːtər').tokens, { useStress: false })
      .slice(0, 5)
      .map((m) => m.word);
    assert.ok(top.includes('water'), top.join(', '));
  });

  it('con acento activado penaliza la sílaba equivocada', () => {
    const right = lexicon
      .searchPhonemes(tokenize('ˈwɔːtə').tokens, { useStress: true })
      .find((m) => m.word === 'water');
    const wrong = lexicon
      .searchPhonemes(tokenize('wɔːˈtə').tokens, { useStress: true })
      .find((m) => m.word === 'water');
    assert.equal(right?.distance, 0);
    assert.equal(wrong?.stressMismatch, true);
  });

  it('las transcripciones de Longman reemplazan a las de Britfone', () => {
    lexicon.upsertFromLdoce('schedule', ['ˈʃedjuːl, ˈske-']);
    const match = lexicon.searchPhonemes(tokenize('ˈskedjuːl').tokens, { useStress: false })[0];
    assert.equal(match.word, 'schedule');
    assert.equal(match.source, 'ldoce');
    assert.equal(match.exact, true);
  });
});
