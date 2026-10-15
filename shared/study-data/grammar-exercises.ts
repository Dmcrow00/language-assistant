import type { ElementRole } from '../grammar';

/**
 * Ejercicios de análisis según Quirk / Greenbaum: el alumno asigna a cada constituyente su
 * función (S V Od Oi Cs Co A), dice cómo es el sujeto y elige el tipo de cláusula. Las respuestas
 * están escritas a mano (no salen del analizador automático), así la corrección es confiable.
 *
 * El inglés no tiene sujeto tácito como el castellano: una cláusula finita lleva sujeto expreso
 * (por eso existen «it» y «there» vacíos: «It's raining» = «Llueve»). Las excepciones son las
 * imperativas (sujeto implícito «you») y las coordinadas que omiten el sujeto de la anterior
 * (sujeto elíptico). Además el sujeto no siempre va primero: preguntas, adverbial adelantado,
 * inversión.
 */

/** Cómo aparece el sujeto en la cláusula. */
export type SubjectKind = 'expreso' | 'implícito' | 'elíptico';

export const SUBJECT_KINDS: ReadonlyArray<{
  kind: SubjectKind;
  label: string;
  description: string;
}> = [
  {
    kind: 'expreso',
    label: 'Expreso',
    description: 'Está escrito en la cláusula, aunque no vaya primero o sea un «it» vacío.',
  },
  {
    kind: 'implícito',
    label: 'Implícito (imperativa)',
    description: 'Imperativa: el sujeto «you» no se escribe.',
  },
  {
    kind: 'elíptico',
    label: 'Elíptico (coordinación)',
    description: 'Se omite porque es el mismo de la cláusula anterior.',
  },
];

export interface ExerciseConstituent {
  text: string;
  role: ElementRole;
}

export interface GrammarExercise {
  constituents: ExerciseConstituent[];
  /** Por defecto «expreso». */
  subject?: SubjectKind;
  /** Lo que va antes y no se analiza: la primera cláusula de una coordinación. */
  context?: string;
  /** Signo final (por defecto el punto). */
  end?: '?' | '!';
  pattern: 'SV' | 'SVO' | 'SVC' | 'SVA' | 'SVOO' | 'SVOC' | 'SVOA';
  /** Por qué, en castellano: se muestra después de corregir. */
  explanation: string;
}

const c = (text: string, role: ElementRole): ExerciseConstituent => ({ text, role });

export const GRAMMAR_EXERCISES: readonly GrammarExercise[] = [
  {
    constituents: [c('The baby', 'S'), c('is sleeping', 'V')],
    pattern: 'SV',
    explanation: '«sleep» es intransitivo: no necesita nada después del verbo.',
  },
  {
    constituents: [c('Our guests', 'S'), c('arrived', 'V'), c('late', 'A')],
    pattern: 'SV',
    explanation:
      '«late» es un adverbial opcional: «Our guests arrived» ya es una cláusula completa.',
  },
  {
    constituents: [c('The sun', 'S'), c('was shining', 'V'), c('brightly', 'A')],
    pattern: 'SV',
    explanation: '«brightly» es opcional; el patrón sigue siendo SV.',
  },
  {
    constituents: [c('My brother', 'S'), c('plays', 'V'), c('the guitar', 'Od')],
    pattern: 'SVO',
    explanation:
      '«the guitar» es objeto directo: responde a «what does he play?» y puede ser sujeto de la pasiva.',
  },
  {
    constituents: [c('She', 'S'), c('has written', 'V'), c('three novels', 'Od')],
    pattern: 'SVO',
    explanation: 'Verbo monotransitivo con un objeto directo (NP).',
  },
  {
    constituents: [c('We', 'S'), c('watched', 'V'), c('a film', 'Od'), c('last night', 'A')],
    pattern: 'SVO',
    explanation: '«last night» es un adverbial de tiempo opcional (NP con función adverbial).',
  },
  {
    constituents: [c('Your idea', 'S'), c('sounds', 'V'), c('interesting', 'Cs')],
    pattern: 'SVC',
    explanation:
      '«sound» funciona como copulativo: «interesting» describe al sujeto (complemento del sujeto).',
  },
  {
    constituents: [c('Her father', 'S'), c('is', 'V'), c('a doctor', 'Cs')],
    pattern: 'SVC',
    explanation:
      'Con «be» copulativo, el NP «a doctor» identifica al sujeto: es complemento del sujeto.',
  },
  {
    constituents: [c('The weather', 'S'), c('became', 'V'), c('very cold', 'Cs')],
    pattern: 'SVC',
    explanation:
      '«become» es copulativo; «very cold» es una AdjP que funciona como complemento del sujeto.',
  },
  {
    constituents: [c('The children', 'S'), c('are', 'V'), c('in the garden', 'A')],
    pattern: 'SVA',
    explanation:
      'Con «be» de lugar, el adverbial es obligatorio: «The children are» no está completo.',
  },
  {
    constituents: [c('My parents', 'S'), c('live', 'V'), c('in Rosario', 'A')],
    pattern: 'SVA',
    explanation: '«live» (residir) pide un adverbial de lugar obligatorio.',
  },
  {
    constituents: [c('The meeting', 'S'), c('is', 'V'), c('on Monday', 'A')],
    pattern: 'SVA',
    explanation: '«be» seguido de un adverbial de tiempo obligatorio.',
  },
  {
    constituents: [c('She', 'S'), c('gave', 'V'), c('her son', 'Oi'), c('a bicycle', 'Od')],
    pattern: 'SVOO',
    explanation:
      'Ditransitivo: «her son» (quién recibe) es objeto indirecto y va antes del directo.',
  },
  {
    constituents: [
      c('The teacher', 'S'),
      c('showed', 'V'),
      c('the class', 'Oi'),
      c('some photos', 'Od'),
    ],
    pattern: 'SVOO',
    explanation:
      'Se puede parafrasear «showed some photos to the class»: «the class» es el objeto indirecto.',
  },
  {
    constituents: [c('My aunt', 'S'), c('sent', 'V'), c('me', 'Oi'), c('a letter', 'Od')],
    pattern: 'SVOO',
    explanation:
      '«me» es el destinatario (objeto indirecto); «a letter», lo enviado (objeto directo).',
  },
  {
    constituents: [c('The news', 'S'), c('made', 'V'), c('everyone', 'Od'), c('happy', 'Co')],
    pattern: 'SVOC',
    explanation: '«happy» describe al objeto («everyone was happy»): es complemento del objeto.',
  },
  {
    constituents: [c('They', 'S'), c('named', 'V'), c('their daughter', 'Od'), c('Lucy', 'Co')],
    pattern: 'SVOC',
    explanation: '«Lucy» identifica al objeto («their daughter is Lucy»): complemento del objeto.',
  },
  {
    constituents: [c('I', 'S'), c('find', 'V'), c('this book', 'Od'), c('boring', 'Co')],
    pattern: 'SVOC',
    explanation: '«find» = considerar: «boring» atribuye una cualidad al objeto.',
  },
  {
    constituents: [c('He', 'S'), c('put', 'V'), c('his keys', 'Od'), c('in his pocket', 'A')],
    pattern: 'SVOA',
    explanation: '«put» exige objeto y adverbial de lugar: «He put his keys» no está completo.',
  },
  {
    constituents: [c('She', 'S'), c('placed', 'V'), c('the vase', 'Od'), c('on the table', 'A')],
    pattern: 'SVOA',
    explanation: '«place» pide un adverbial de lugar obligatorio además del objeto.',
  },
  {
    constituents: [
      c('You', 'S'),
      c('should keep', 'V'),
      c('the milk', 'Od'),
      c('in the fridge', 'A'),
    ],
    pattern: 'SVOA',
    explanation:
      '«keep» con el sentido de «guardar en un lugar» pide objeto + adverbial obligatorio.',
  },
  // --- El sujeto no va primero: preguntas -----------------------------------------------
  {
    constituents: [
      c('Did', 'V'),
      c('you', 'S'),
      c('send', 'V'),
      c('her', 'Oi'),
      c('the letter', 'Od'),
    ],
    end: '?',
    pattern: 'SVOO',
    explanation:
      'En las preguntas el sujeto va entre el auxiliar y el verbo léxico: la frase verbal «did … send» queda partida, pero es un solo elemento V. El patrón no cambia: SVOO.',
  },
  {
    constituents: [
      c('Where', 'A'),
      c('did', 'V'),
      c('you', 'S'),
      c('put', 'V'),
      c('my glasses', 'Od'),
    ],
    end: '?',
    pattern: 'SVOA',
    explanation:
      '«put» exige un adverbial de lugar: en la pregunta es «where», que va al comienzo por ser palabra interrogativa. Sigue siendo SVOA.',
  },
  {
    constituents: [c('What', 'Od'), c('does', 'V'), c('your sister', 'S'), c('do', 'V')],
    end: '?',
    pattern: 'SVO',
    explanation:
      '«what» es el objeto directo de «do», adelantado por ser interrogativo (la respuesta sería «She teaches English»: SVO).',
  },
  {
    constituents: [c('Is', 'V'), c('the museum', 'S'), c('open', 'Cs'), c('on Sundays', 'A')],
    end: '?',
    pattern: 'SVC',
    explanation:
      'Con «be» la inversión pone el verbo entero antes del sujeto. «open» es complemento del sujeto; «on Sundays», un adverbial opcional.',
  },
  // --- Adverbial al comienzo, con o sin inversión ------------------------------------------
  {
    constituents: [
      c('Last summer', 'A'),
      c('we', 'S'),
      c('visited', 'V'),
      c('our grandparents', 'Od'),
    ],
    pattern: 'SVO',
    explanation:
      'Un adverbial puede ir al comienzo sin cambiar el orden del resto. «Last summer» es opcional: el patrón es SVO.',
  },
  {
    constituents: [c('In the corner', 'A'), c('stood', 'V'), c('an old piano', 'S')],
    pattern: 'SVA',
    explanation:
      'Inversión: con un adverbial de lugar adelante, el sujeto va después del verbo («An old piano stood in the corner»). «stand» de lugar pide el adverbial: SVA.',
  },
  {
    constituents: [c('Here', 'A'), c('comes', 'V'), c('the bus', 'S')],
    end: '!',
    pattern: 'SVA',
    explanation:
      'Con «here» o «there» al comienzo, el sujeto nominal va después del verbo (con un pronombre no hay inversión: «Here it comes»). «come» de dirección pide el adverbial.',
  },
  {
    constituents: [
      c('Never', 'A'),
      c('have', 'V'),
      c('I', 'S'),
      c('seen', 'V'),
      c('such a mess', 'Od'),
    ],
    pattern: 'SVO',
    explanation:
      'Un adverbial negativo al comienzo provoca inversión sujeto-auxiliar, como en una pregunta. «never» es un adverbial, no parte del verbo.',
  },
  // --- Sujeto vacío «it» ----------------------------------------------------------------------
  {
    constituents: [c('It', 'S'), c('is raining', 'V')],
    pattern: 'SV',
    explanation:
      '«it» es un sujeto vacío (prop it): no se refiere a nada, pero el inglés exige sujeto expreso. En castellano decimos «Llueve», sin sujeto.',
  },
  {
    constituents: [c('It', 'S'), c('was', 'V'), c('very cold', 'Cs'), c('yesterday', 'A')],
    pattern: 'SVC',
    explanation:
      'Otra vez «it» vacío, con el estado del tiempo: «very cold» es complemento del sujeto y «yesterday», un adverbial opcional.',
  },
  // --- Sujeto implícito: imperativas ----------------------------------------------------------
  {
    constituents: [c('Put', 'V'), c('the milk', 'Od'), c('in the fridge', 'A')],
    subject: 'implícito',
    pattern: 'SVOA',
    explanation:
      'Imperativa: el sujeto «you» está implícito. El patrón se define igual: «put» pide objeto y adverbial (SVOA).',
  },
  {
    constituents: [c('Be', 'V'), c('quiet', 'Cs')],
    subject: 'implícito',
    end: '!',
    pattern: 'SVC',
    explanation: 'Imperativa de «be»: «quiet» es complemento del sujeto implícito «you».',
  },
  {
    constituents: [c('Give', 'V'), c('me', 'Oi'), c('a hand', 'Od')],
    subject: 'implícito',
    pattern: 'SVOO',
    explanation:
      'Imperativa con dos objetos: «me» es el objeto indirecto y «a hand», el directo. Sujeto implícito «you».',
  },
  {
    constituents: [c("Don't leave", 'V'), c('the door', 'Od'), c('open', 'Co')],
    subject: 'implícito',
    pattern: 'SVOC',
    explanation:
      "Imperativa negativa: «don't leave» es la frase verbal (con do). «open» describe al objeto: complemento del objeto.",
  },
  // --- Sujeto elíptico: coordinación -----------------------------------------------------------
  {
    context: 'She closed the window and',
    constituents: [c('turned off', 'V'), c('the lights', 'Od')],
    subject: 'elíptico',
    pattern: 'SVO',
    explanation:
      'Segunda cláusula coordinada: su sujeto («she») se omite porque es el mismo de la anterior. «turn off» es un verbo frasal: la partícula es parte del verbo.',
  },
  {
    context: 'He came home late and',
    constituents: [c('went', 'V'), c('straight to bed', 'A')],
    subject: 'elíptico',
    pattern: 'SVA',
    explanation:
      'Sujeto elíptico («he»). «go» de dirección pide el adverbial «straight to bed»: SVA.',
  },
  {
    context: 'My brother plays the guitar but',
    constituents: [c('never', 'A'), c('sings', 'V')],
    subject: 'elíptico',
    pattern: 'SV',
    explanation:
      'Sujeto elíptico («my brother»). «never» es un adverbial opcional: el patrón es SV.',
  },
];

/** La oración completa, con el contexto y el signo final. */
export function exerciseSentence(exercise: GrammarExercise): string {
  const words = [exercise.context, ...exercise.constituents.map((x) => x.text)].filter(Boolean);
  return `${words.join(' ')}${exercise.end ?? '.'}`;
}
