import { exerciseSentence, GRAMMAR_EXERCISES } from '../../../shared/study-data/grammar-exercises';
import { IRREGULAR_VERBS, verbPattern } from '../../../shared/study-data/irregular-verbs';

/**
 * Material de estudio de shared/study-data (lo usa sólo la interfaz). Antes estaba en
 * electron/test/study.test.ts; lo que depende del diccionario (que cada palabra tenga transcripción)
 * pasó a los tests del motor Java (StudyTest), que leen una copia en JSON (npm run export:study-data).
 */
describe('material de estudio', () => {
  it('clasifica los verbos por patrón de formas', () => {
    const find = (base: string) => IRREGULAR_VERBS.find((v) => v.base === base)!;
    expect(verbPattern(find('cut'))).toBe('AAA');
    expect(verbPattern(find('keep'))).toBe('ABB');
    expect(verbPattern(find('come'))).toBe('ABA');
    expect(verbPattern(find('go'))).toBe('ABC');
    // read: misma ortografía, distinta pronunciación.
    expect(verbPattern(find('read'))).toBe('ABB');
  });

  it('los ejercicios tienen verbo y un patrón coherente con sus elementos y su sujeto', () => {
    for (const exercise of GRAMMAR_EXERCISES) {
      const roles = exercise.constituents.map((c) => c.role);
      const subject = exercise.subject ?? 'expreso';
      const name = exerciseSentence(exercise);
      expect(roles, name).toContain('V');
      // Sujeto expreso: está entre los constituyentes; implícito o elíptico: no está.
      expect(roles.includes('S'), name).toBe(subject === 'expreso');
      // Sólo las coordinadas con sujeto elíptico muestran la cláusula anterior como contexto.
      expect(!!exercise.context, name).toBe(subject === 'elíptico');
      const required = exercise.pattern.slice(2); // lo que sigue a "SV"
      if (required.includes('O')) expect(roles, exercise.pattern).toContain('Od');
      if (exercise.pattern === 'SVOO') expect(roles).toContain('Oi');
      if (exercise.pattern.endsWith('C'))
        expect(roles.includes('Cs') || roles.includes('Co'), exercise.pattern).toBe(true);
    }
  });
});
