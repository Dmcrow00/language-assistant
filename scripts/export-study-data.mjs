// Copia el material de estudio de shared/study-data (TypeScript, lo usa la interfaz) a JSON para los tests
// del motor Java: cada palabra del dictado, de los pares mínimos y de los verbos irregulares tiene que tener
// transcripción, y los 38 ejercicios de gramática tienen que dar la misma respuesta que el analizador.
//
//   npm run export:study-data
//
// El CI lo vuelve a correr y falla si el JSON versionado quedó desactualizado.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const compiled = (name) => require(join(root, 'dist-electron', 'shared', 'study-data', `${name}.js`));

const { DICTATION_LEVELS, MINIMAL_PAIRS } = compiled('phonetics-practice');
const { IRREGULAR_VERBS } = compiled('irregular-verbs');
const { GRAMMAR_EXERCISES, exerciseSentence } = compiled('grammar-exercises');

const data = {
  dictationLevels: DICTATION_LEVELS.map(({ id, items, phrases }) => ({ id, items, phrases: !!phrases })),
  minimalPairs: MINIMAL_PAIRS.map(({ id, pairs }) => ({ id, pairs })),
  irregularVerbs: IRREGULAR_VERBS.map(({ base, past, participle, prons }) => ({
    base,
    past,
    participle,
    prons: prons ?? {},
  })),
  grammarExercises: GRAMMAR_EXERCISES.map((exercise) => ({
    sentence: exerciseSentence(exercise),
    subject: exercise.subject ?? 'expreso',
    pattern: exercise.pattern,
    roles: exercise.constituents.map((c) => c.role),
  })),
};

const out = join(root, 'sidecar-java', 'src', 'test', 'resources', 'study-data.json');
writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`, 'utf8');
console.log(`ok  ${out}`);
