import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { ClauseAnalysis } from '../../shared/grammar';
import { exerciseSentence, GRAMMAR_EXERCISES } from '../../shared/study-data/grammar-exercises';
import { NlpClient, ParsedToken } from '../grammar/nlp-client';
import { analyzeGrammar } from '../grammar/quirk-analysis';

const ROOT = join(__dirname, '..', '..', '..');
// Respuestas reales de spaCy (en_core_web_sm 3.8.0) guardadas: las pruebas no necesitan Python.
const PARSES = JSON.parse(
  readFileSync(join(ROOT, 'electron', 'test', 'fixtures', 'spacy-parses.json'), 'utf8'),
) as Record<string, ParsedToken[]>;

function analyze(sentence: string) {
  const tokens = PARSES[sentence];
  assert.ok(tokens, `falta el análisis de «${sentence}» en el fixture`);
  return analyzeGrammar(tokens).sentences[0];
}

/** "S V Od" con el texto de cada elemento: S=«She» V=«reads» Od=«novels». */
function elements(clause: ClauseAnalysis): string {
  return clause.elements.map((e) => `${e.role}${e.obligatory ? '*' : ''}=«${e.text}»`).join(' ');
}

describe('los siete tipos de cláusula de Quirk', () => {
  const cases: Array<[string, string, string]> = [
    ['The children were sleeping.', 'SV', 'S=«The children» V=«were sleeping»'],
    ['She reads novels.', 'SVO', 'S=«She» V=«reads» Od=«novels»'],
    ['The soup tasted delicious.', 'SVC', 'S=«The soup» V=«tasted» Cs=«delicious»'],
    ['My keys are in the drawer.', 'SVA', 'S=«My keys» V=«are» A*=«in the drawer»'],
    ['He sent his sister a postcard.', 'SVOO', 'S=«He» V=«sent» Oi=«his sister» Od=«a postcard»'],
    ['They painted the walls white.', 'SVOC', 'S=«They» V=«painted» Od=«the walls» Co=«white»'],
    ['She put the keys on the table.', 'SVOA', 'S=«She» V=«put» Od=«the keys» A*=«on the table»'],
  ];
  for (const [sentence, pattern, expected] of cases) {
    it(`${pattern}: ${sentence}`, () => {
      const clause = analyze(sentence).clauses[0];
      assert.equal(clause.pattern, pattern);
      assert.equal(elements(clause), expected);
    });
  }

  it('corrige el error del modelo en «elected her president» (Od + Co)', () => {
    const clause = analyze('They elected her president.').clauses[0];
    assert.equal(clause.pattern, 'SVOC');
    assert.equal(elements(clause), 'S=«They» V=«elected» Od=«her» Co=«president»');
  });

  // Otros errores del modelo chico en SVOC y SVOA.
  const fixes: Array<[string, string, string]> = [
    ['The news made everyone happy.', 'SVOC', 'S=«The news» V=«made» Od=«everyone» Co=«happy»'],
    ['I find this book boring.', 'SVOC', 'S=«I» V=«find» Od=«this book» Co=«boring»'],
    ['They named their daughter Lucy.', 'SVOC', 'S=«They» V=«named» Od=«their daughter» Co=«Lucy»'],
    [
      'She placed the vase on the table.',
      'SVOA',
      'S=«She» V=«placed» Od=«the vase» A*=«on the table»',
    ],
  ];
  for (const [sentence, pattern, expected] of fixes) {
    it(`corrige: ${sentence}`, () => {
      const clause = analyze(sentence).clauses[0];
      assert.equal(clause.pattern, pattern);
      assert.equal(elements(clause), expected);
    });
  }
});

describe('casos especiales', () => {
  it('existencial: there = sujeto vacío, sujeto nocional y el lugar como adverbial', () => {
    const clause = analyze('There is a cat on the roof.').clauses[0];
    assert.equal(clause.pattern, 'existencial');
    assert.equal(elements(clause), 'S=«There» V=«is» S=«a cat» A*=«on the roof»');
  });

  it('paráfrasis preposicional del objeto indirecto, con aclaración', () => {
    const clause = analyze('I gave the book to my brother.').clauses[0];
    const to = clause.elements.find((e) => e.text === 'to my brother');
    assert.equal(to?.role, 'A');
    assert.match(to?.note ?? '', /objeto indirecto/);
  });

  it('pasiva: el agente es adverbial opcional', () => {
    const sentence = analyze('The letter was written by a famous poet.');
    const clause = sentence.clauses[0];
    assert.equal(clause.pattern, 'SV');
    assert.match(clause.patternNote ?? '', /pasiva/);
    assert.equal(sentence.verbPhrases[0].label, 'past simple passive');
  });

  it('imperativa con sujeto implícito', () => {
    const sentence = analyze('Close the door!');
    assert.equal(sentence.form, 'imperativa');
    assert.equal(sentence.clauses[0].pattern, 'SVO');
  });

  it('pregunta con el verbo partido (Have … been)', () => {
    const sentence = analyze('Have you ever been to London?');
    assert.equal(sentence.form, 'interrogativa');
    const verb = sentence.clauses[0].elements.find((e) => e.role === 'V');
    assert.equal(verb?.text, 'Have … been');
    assert.equal(verb?.pieces?.length, 2);
    assert.equal(sentence.verbPhrases[0].label, 'present perfect');
  });

  it('verbo frasal: la partícula es parte del verbo', () => {
    const clause = analyze('He gave up smoking last year.').clauses[0];
    assert.equal(elements(clause), 'S=«He» V=«gave up» Od=«smoking» A=«last year»');
  });
});

describe('oraciones compuestas y complejas', () => {
  it('cláusula nominal finita como objeto', () => {
    const sentence = analyze('I think that she has left.');
    assert.equal(sentence.structure, 'compleja');
    const object = sentence.clauses[0].elements.find((e) => e.role === 'Od');
    assert.equal(object?.form, 'clause');
    assert.equal(object?.clause?.label, 'cláusula nominal finita introducida por «that»');
  });

  it('relativa dentro del sujeto (posmodificador del NP)', () => {
    const sentence = analyze('The man who lives next door is a doctor.');
    const subject = sentence.clauses[0].elements.find((e) => e.role === 'S');
    const relative = subject?.structure?.find((p) => p.role === 'posmodificador')?.clause;
    assert.equal(relative?.kind, 'relativa');
    assert.match(relative?.label ?? '', /«who»/);
    assert.equal(subject?.structure?.find((p) => p.role === 'núcleo')?.text, 'man');
  });

  it('adverbial introducida por "when" (el subordinante no es un elemento)', () => {
    const clause = analyze('When it rains, we stay at home.').clauses[0];
    const adverbial = clause.elements[0];
    assert.equal(adverbial.clause?.label, 'cláusula adverbial finita introducida por «when»');
    assert.equal(elements(adverbial.clause!), 'S=«it» V=«rains»');
    assert.equal(clause.pattern, 'SVA');
  });

  it('compuesta-compleja: coordinada con "and" y una no finita', () => {
    const sentence = analyze('She wants to learn French and he plays the piano.');
    assert.equal(sentence.structure, 'compuesta-compleja');
    assert.equal(sentence.clauses.length, 2);
    assert.equal(sentence.clauses[0].text, 'She wants to learn French');
    assert.equal(sentence.clauses[1].coordinator, 'and');
    assert.equal(
      sentence.clauses[0].elements[2].clause?.verbPhrase?.nonFiniteForm,
      'to-infinitive',
    );
  });

  it('coordinada con sujeto elíptico', () => {
    const sentence = analyze('She sang and danced.');
    assert.equal(sentence.structure, 'compuesta');
    assert.equal(sentence.clauses[0].text, 'She sang');
    assert.match(sentence.clauses[1].patternNote ?? '', /elíptico/);
  });
});

describe('sujeto ausente o fuera de lugar', () => {
  const cases: Array<[string, string, string]> = [
    // Preguntas: el sujeto va entre el auxiliar y el verbo léxico.
    ['Did you send her the letter?', 'SVOO', 'V=«Did … send» S=«you» Oi=«her» Od=«the letter»'],
    ['Where did you put my glasses?', 'SVOA', 'A*=«Where» V=«did … put» S=«you» Od=«my glasses»'],
    ['What does your sister do?', 'SVO', 'Od=«What» V=«does … do» S=«your sister»'],
    ['Is the museum open on Sundays?', 'SVC', 'V=«Is» S=«the museum» Cs=«open» A=«on Sundays»'],
    // Adverbial adelante, con o sin inversión.
    [
      'Last summer we visited our grandparents.',
      'SVO',
      'A=«Last summer» S=«we» V=«visited» Od=«our grandparents»',
    ],
    ['In the corner stood an old piano.', 'SVA', 'A*=«In the corner» V=«stood» S=«an old piano»'],
    ['Here comes the bus!', 'SVA', 'A*=«Here» V=«comes» S=«the bus»'],
    ['Never have I seen such a mess.', 'SVO', 'A=«Never» V=«have … seen» S=«I» Od=«such a mess»'],
    // Sujeto vacío "it".
    ['It is raining.', 'SV', 'S=«It» V=«is raining»'],
    // Imperativas: sujeto implícito.
    ['Put the milk in the fridge.', 'SVOA', 'V=«Put» Od=«the milk» A*=«in the fridge»'],
    ['Be quiet!', 'SVC', 'V=«Be» Cs=«quiet»'],
    ['Give me a hand.', 'SVOO', 'V=«Give» Oi=«me» Od=«a hand»'],
    ["Don't leave the door open.", 'SVOC', "V=«Don't leave» Od=«the door» Co=«open»"],
  ];
  for (const [sentence, pattern, expected] of cases) {
    it(`${pattern}: ${sentence}`, () => {
      const clause = analyze(sentence).clauses[0];
      assert.equal(clause.pattern, pattern);
      assert.equal(elements(clause), expected);
    });
  }

  it("las imperativas (también con «don't») se reconocen como tales", () => {
    for (const sentence of [
      'Put the milk in the fridge.',
      'Be quiet!',
      "Don't leave the door open.",
    ]) {
      const result = analyze(sentence);
      assert.equal(result.form, 'imperativa', sentence);
      assert.match(result.clauses[0].patternNote ?? '', /implícito/);
    }
  });

  it('"never" es un adverbial, no parte del grupo verbal, y la inversión es finita', () => {
    const vp = analyze('Never have I seen such a mess.').verbPhrases[0];
    assert.equal(vp.label, 'present perfect');
    assert.equal(vp.finite, true);
  });

  it('coordinada con sujeto elíptico', () => {
    const clauses = analyze('She closed the window and turned off the lights.').clauses;
    assert.equal(elements(clauses[1]), 'V=«turned off» Od=«the lights»');
    assert.match(clauses[1].patternNote ?? '', /elíptico/);
  });
});

describe('grupo verbal', () => {
  it('modal + perfect passive', () => {
    const vp = analyze('The book might have been stolen.').verbPhrases[0];
    assert.equal(vp.label, 'modal «might» + perfect passive');
    assert.deepEqual(
      vp.parts.map((p) => p.role),
      ['modal', 'auxiliar de perfecto', 'auxiliar de pasiva', 'verbo léxico'],
    );
  });

  it('pasado progresivo', () => {
    const vp = analyze('The children were sleeping.').verbPhrases[0];
    assert.equal(vp.label, 'past progressive');
    assert.match(vp.description, /pasado.*progresivo.*activa/);
  });
});

describe('ejercicios con el análisis guardado de spaCy', () => {
  // Igual que la prueba con el analizador real de abajo, pero sin Python: el fixture tiene los 38.
  it('coincide con las respuestas de los 38 ejercicios', () => {
    const differences: string[] = [];
    for (const exercise of GRAMMAR_EXERCISES) {
      const text = exerciseSentence(exercise);
      const sentence = analyze(text);
      const clause = exercise.subject === 'elíptico' ? sentence.clauses[1] : sentence.clauses[0];
      const key = exercise.constituents
        .map((c) => c.role)
        .filter((role, i, all) => role !== 'V' || all.indexOf('V') === i)
        .join(' ');
      const auto = clause?.elements.map((e) => e.role).join(' ');
      if (clause?.pattern !== exercise.pattern || auto !== key) {
        differences.push(`${text}: ${exercise.pattern} ${key} ≠ ${clause?.pattern} ${auto}`);
      }
    }
    assert.equal(GRAMMAR_EXERCISES.length, 38);
    assert.deepEqual(differences, []);
  });
});

describe('analizador spaCy real', () => {
  const client = NlpClient.locate(join(ROOT, 'resources'), ROOT);
  after(() => client?.dispose());

  it('responde con el árbol de dependencias', { skip: !client }, async () => {
    const tokens = await client!.parse('She reads novels.');
    assert.deepEqual(
      tokens.map((t) => t.dep),
      ['nsubj', 'ROOT', 'dobj', 'punct'],
    );
  });

  // Las respuestas de los ejercicios están escritas a mano; el analizador tiene que coincidir.
  // (En el ejercicio el verbo partido de las preguntas son dos piezas; en el análisis, un solo V.)
  it('coincide con las respuestas de los ejercicios', { skip: !client }, async () => {
    const differences: string[] = [];
    for (const exercise of GRAMMAR_EXERCISES) {
      const text = exerciseSentence(exercise);
      const sentence = analyzeGrammar(await client!.parse(text)).sentences[0];
      const clause = exercise.subject === 'elíptico' ? sentence.clauses[1] : sentence.clauses[0];
      const key = exercise.constituents
        .map((c) => c.role)
        .filter((role, i, all) => role !== 'V' || all.indexOf('V') === i)
        .join(' ');
      const auto = clause?.elements.map((e) => e.role).join(' ');
      if (clause?.pattern !== exercise.pattern || auto !== key) {
        differences.push(`${text}: ${exercise.pattern} ${key} ≠ ${clause?.pattern} ${auto}`);
      }
    }
    assert.deepEqual(differences, []);
  });
});
