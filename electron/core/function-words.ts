import type { WordStrength } from '../../shared/fonetica-api';

/**
 * Function words con forma fuerte y débil (Roach, "English Phonetics and Phonology", cap. 12),
 * escritas en la notación de Longman. Esta tabla se usa mientras la palabra no se consultó en
 * Longman; cuando hay datos de Longman (the /ðə; before vowels ði; strong ðiː/) mandan esos.
 *
 * - weak: formas débiles; la primera es la habitual ante consonante. Si hay una con /h/ y otra
 *   sin /h/, la /h/ se pronuncia sólo al comienzo de la oración (Roach: "his" /ɪz/ ~ /hɪz/).
 * - weakBeforeVowel: forma débil distinta ante vocal (the → ði, to → tʊ).
 * Las que terminan en "r" escrita (for, her, are…) no necesitan forma ante vocal: la /r/ de
 * enlace se agrega con la regla general (for‿it → /fər ɪt/).
 */

export interface FunctionWordForms {
  category: string;
  weak: string[];
  weakBeforeVowel?: string;
  strong: string;
}

export const FUNCTION_WORDS: Readonly<Record<string, FunctionWordForms>> = {
  a: { category: 'artículo', weak: ['ə'], strong: 'eɪ' },
  an: { category: 'artículo', weak: ['ən'], strong: 'æn' },
  the: { category: 'artículo', weak: ['ðə'], weakBeforeVowel: 'ði', strong: 'ðiː' },
  and: { category: 'conjunción', weak: ['(ə)n', '(ə)nd'], weakBeforeVowel: '(ə)nd', strong: 'ænd' },
  but: { category: 'conjunción', weak: ['bət'], strong: 'bʌt' },
  that: { category: 'conjunción / relativo', weak: ['ðət'], strong: 'ðæt' },
  than: { category: 'conjunción', weak: ['ðən'], strong: 'ðæn' },
  as: { category: 'conjunción / preposición', weak: ['əz'], strong: 'æz' },
  at: { category: 'preposición', weak: ['ət'], strong: 'æt' },
  for: { category: 'preposición', weak: ['fə'], strong: 'fɔː' },
  from: { category: 'preposición', weak: ['frəm'], strong: 'frɒm' },
  of: { category: 'preposición', weak: ['əv'], strong: 'ɒv' },
  to: { category: 'preposición', weak: ['tə'], weakBeforeVowel: 'tʊ', strong: 'tuː' },
  some: { category: 'determinante', weak: ['səm'], strong: 'sʌm' },
  there: { category: 'there existencial', weak: ['ðə'], strong: 'ðeə' },
  his: { category: 'determinante posesivo', weak: ['ɪz', 'hɪz'], strong: 'hɪz' },
  her: { category: 'pronombre / posesivo', weak: ['ə', 'hə'], strong: 'hɜː' },
  your: { category: 'determinante posesivo', weak: ['jə'], strong: 'jɔː' },
  he: { category: 'pronombre', weak: ['i', 'hi'], strong: 'hiː' },
  she: { category: 'pronombre', weak: ['ʃi'], strong: 'ʃiː' },
  we: { category: 'pronombre', weak: ['wi'], strong: 'wiː' },
  you: { category: 'pronombre', weak: ['ju'], strong: 'juː' },
  me: { category: 'pronombre', weak: ['mi'], strong: 'miː' },
  him: { category: 'pronombre', weak: ['ɪm', 'hɪm'], strong: 'hɪm' },
  them: { category: 'pronombre', weak: ['ðəm'], strong: 'ðem' },
  us: { category: 'pronombre', weak: ['əs'], strong: 'ʌs' },
  can: { category: 'auxiliar modal', weak: ['kən'], strong: 'kæn' },
  could: { category: 'auxiliar modal', weak: ['kəd'], strong: 'kʊd' },
  shall: { category: 'auxiliar modal', weak: ['ʃəl'], strong: 'ʃæl' },
  should: { category: 'auxiliar modal', weak: ['ʃəd'], strong: 'ʃʊd' },
  must: {
    category: 'auxiliar modal',
    weak: ['məs', 'məst'],
    weakBeforeVowel: 'məst',
    strong: 'mʌst',
  },
  would: { category: 'auxiliar modal', weak: ['wəd', 'əd'], strong: 'wʊd' },
  will: { category: 'auxiliar modal', weak: ['wəl', 'əl'], strong: 'wɪl' },
  have: { category: 'auxiliar', weak: ['əv', 'həv'], strong: 'hæv' },
  has: { category: 'auxiliar', weak: ['əz', 'həz'], strong: 'hæz' },
  had: { category: 'auxiliar', weak: ['əd', 'həd'], strong: 'hæd' },
  do: { category: 'auxiliar', weak: ['də'], weakBeforeVowel: 'dʊ', strong: 'duː' },
  does: { category: 'auxiliar', weak: ['dəz'], strong: 'dʌz' },
  am: { category: 'verbo be', weak: ['əm'], strong: 'æm' },
  are: { category: 'verbo be', weak: ['ə'], strong: 'ɑː' },
  was: { category: 'verbo be', weak: ['wəz'], strong: 'wɒz' },
  were: { category: 'verbo be', weak: ['wə'], strong: 'wɜː' },
  be: { category: 'verbo be', weak: ['bi'], strong: 'biː' },
  been: { category: 'verbo be', weak: ['bɪn'], strong: 'biːn' },
};

const PERSONAL_PRONOUNS = new Set(['he', 'she', 'we', 'you', 'me', 'him', 'her', 'them', 'us']);
const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'there']);
/** Palabras con las que suele empezar un sujeto: después de ellas "that" es conjunción o relativo. */
const SUBJECT_STARTERS = new Set([
  ...SUBJECT_PRONOUNS,
  'the',
  'a',
  'an',
  'this',
  'these',
  'those',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'someone',
  'somebody',
  'everyone',
  'everybody',
  'nobody',
  'people',
]);
/** Después de "there", indican el there existencial ("there is…"). */
const EXISTENTIAL_FOLLOWERS = new Set([
  'is',
  "'s",
  'are',
  'was',
  'were',
  'will',
  "'ll",
  'would',
  'be',
  'been',
  'has',
  'have',
  'had',
  'must',
  'may',
  'might',
  'could',
  'should',
  'can',
  'seems',
  'seem',
  'seemed',
  'appears',
  'used',
]);
const IRREGULAR_PARTICIPLES = new Set(
  (
    'been got gotten done gone had made seen said taken come become written given known left lost ' +
    'found thought told heard felt kept brought bought caught taught sent spent built meant met paid ' +
    'put read run sat stood understood won begun broken chosen drunk eaten fallen forgotten hidden ' +
    'ridden risen shown spoken stolen sung swum thrown woken worn driven flown grown drawn let cut hit ' +
    'set shut hurt cost beaten bitten blown fed fought forgiven frozen held hung laid led lent lit ' +
    'meant rung shaken shot slept sold sworn swept torn thrown wept wound'
  ).split(' '),
);

export interface FormContext {
  key: string;
  next: string | null;
  /** Primera palabra de la oración. */
  sentenceInitial: boolean;
  /** Después viene una pausa (coma, punto, fin del texto). */
  beforePause: boolean;
  /** La oración termina en "?". */
  question: boolean;
  /** Forma elegida por el alumno, si eligió una. */
  override?: WordStrength;
  connected: boolean;
}

export interface FormDecision {
  form: WordStrength;
  reason: string;
  ambiguous?: string;
}

/**
 * Decide forma fuerte o débil según Roach: la forma débil es la normal en habla conectada;
 * la fuerte va al final de la oración o antes de una pausa (salvo los pronombres personales),
 * cuando la palabra está enfatizada o en contraste, y en ciertos usos (that demostrativo,
 * there de lugar, have/do como verbo principal).
 */
export function decideForm(ctx: FormContext): FormDecision {
  if (!ctx.connected)
    return { form: 'strong', reason: 'Forma de cita: el habla conectada está desactivada.' };
  if (ctx.override === 'strong') {
    return {
      form: 'strong',
      reason: 'La marcaste como enfatizada o en contraste: va en forma fuerte.',
    };
  }
  if (ctx.override === 'weak')
    return { form: 'weak', reason: 'La marcaste sin énfasis: va en forma débil.' };

  if (ctx.beforePause) {
    if (PERSONAL_PRONOUNS.has(ctx.key)) {
      return {
        form: 'weak',
        reason: 'Los pronombres personales mantienen la forma débil también al final.',
      };
    }
    return {
      form: 'strong',
      reason:
        'Al final de la oración o antes de una pausa se usa la forma fuerte («Where are you from?»).',
    };
  }

  const next = ctx.next;
  switch (ctx.key) {
    case 'that':
      return next && SUBJECT_STARTERS.has(next)
        ? {
            form: 'weak',
            reason: 'Como conjunción o pronombre relativo («I think that he…») va débil.',
            ambiguous: 'Si es demostrativo («that book», «I like that») va fuerte: /ðæt/.',
          }
        : {
            form: 'strong',
            reason: 'Como demostrativo («that book») va fuerte.',
            ambiguous: 'Si es conjunción o relativo («the man that I saw») va débil: /ðət/.',
          };
    case 'there':
      return next && EXISTENTIAL_FOLLOWERS.has(next)
        ? { form: 'weak', reason: '«There» existencial («there is / there are») va débil.' }
        : {
            form: 'strong',
            reason: 'Como adverbio de lugar («over there», «go there») va fuerte.',
          };
    case 'some':
      return next === 'of'
        ? { form: 'strong', reason: 'Como pronombre («some of them») va fuerte.' }
        : {
            form: 'weak',
            reason: 'Delante de un sustantivo, con el sentido de «algo de / unos», va débil.',
            ambiguous:
              'Con el sentido de «cierto, alguno en particular» («Some people say…») va fuerte.',
          };
    case 'have':
    case 'has':
    case 'had':
      return next && (isParticiple(next) || SUBJECT_PRONOUNS.has(next))
        ? {
            form: 'weak',
            reason: 'Como auxiliar («have seen», «has done») va débil.',
            ambiguous: 'Como verbo principal («I have a car», «have to») suele ir fuerte.',
          }
        : {
            form: 'strong',
            reason: 'Como verbo principal («have a car», «have to») suele ir fuerte.',
            ambiguous: 'Si es auxiliar de un tiempo perfecto va débil.',
          };
    case 'do':
    case 'does':
      return next && (SUBJECT_PRONOUNS.has(next) || (ctx.question && SUBJECT_STARTERS.has(next)))
        ? {
            form: 'weak',
            reason: 'Como auxiliar en preguntas («Do you…?», «What does she…?») va débil.',
          }
        : {
            form: 'strong',
            reason: 'Como verbo principal («do the shopping») o en negativas va fuerte.',
            ambiguous: 'Si es auxiliar de una pregunta va débil.',
          };
  }

  return {
    form: 'weak',
    reason: 'Sin énfasis, en habla conectada, las function words van en forma débil.',
  };
}

function isParticiple(word: string): boolean {
  return IRREGULAR_PARTICIPLES.has(word) || /(ed|en|wn)$/.test(word);
}

/**
 * Elige entre las formas débiles. Si hay variantes con y sin /h/, la /h/ se pronuncia sólo al
 * comienzo de la oración. Ante vocal se usa la forma específica si existe.
 */
export function pickWeakForm(
  weak: readonly string[],
  weakBeforeVowel: string | undefined,
  sentenceInitial: boolean,
  nextStartsWithVowel: boolean,
): string {
  if (nextStartsWithVowel && weakBeforeVowel) return weakBeforeVowel;
  const withH = weak.find((w) => w.replace(/[ˈˌ(]/g, '').startsWith('h'));
  const withoutH = weak.find((w) => !w.replace(/[ˈˌ(]/g, '').startsWith('h'));
  if (withH && withoutH) return sentenceInitial ? withH : withoutH;
  return weak[0];
}
