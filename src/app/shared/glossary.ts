/**
 * Glosario de la app: los términos de la materia que aparecen en pantalla, explicados para un
 * estudiante en formación. Se abren con el «?» que acompaña a cada término (app-term) y se
 * listan completos en Ayuda.
 */
export interface GlossaryEntry {
  term: string;
  definition: string;
  group: 'Fonética' | 'Gramática' | 'La app';
}

export const GLOSSARY = {
  rp: {
    term: 'RP (Received Pronunciation)',
    definition:
      'La pronunciación británica de referencia: la que se enseña en el profesorado y la que usan los diccionarios.',
    group: 'Fonética',
  },
  transcripcion: {
    term: 'Transcripción fonémica',
    definition:
      'La palabra escrita con un símbolo por cada sonido, entre barras: thought se escribe /θɔːt/.',
    group: 'Fonética',
  },
  monoptongo: {
    term: 'Monoptongo',
    definition: 'Vocal pura: la boca no cambia de posición mientras suena, como /æ/ en cat.',
    group: 'Fonética',
  },
  diptongo: {
    term: 'Diptongo',
    definition:
      'Vocal que se desliza de una posición a otra dentro de la misma sílaba, como /aɪ/ en my.',
    group: 'Fonética',
  },
  'vocal-larga': {
    term: 'Vocal larga',
    definition:
      'Los dos puntos ː indican que la vocal dura más. Compará shot /ʃɒt/ con short /ʃɔːt/.',
    group: 'Fonética',
  },
  schwa: {
    term: 'Schwa /ə/',
    definition:
      'La vocal más frecuente del inglés: corta, relajada y sin acento, como la primera de about /əˈbaʊt/.',
    group: 'Fonética',
  },
  'vocal-debil': {
    term: 'Vocales débiles /i/ y /u/',
    definition: 'Versiones cortas y sin acento de /iː/ y /uː/, como al final de happy /ˈhæpi/.',
    group: 'Fonética',
  },
  acento: {
    term: 'Acento (ˈ y ˌ)',
    definition:
      'ˈ va antes de la sílaba que se dice con más fuerza; ˌ marca un acento más suave: education /ˌedʒʊˈkeɪʃən/.',
    group: 'Fonética',
  },
  'sorda-sonora': {
    term: 'Consonante sorda y sonora',
    definition:
      'En las sonoras vibran las cuerdas vocales (/b/, /z/); en las sordas, no (/p/, /s/). Probá con la mano en la garganta.',
    group: 'Fonética',
  },
  'sonido-opcional': {
    term: 'Sonido opcional',
    definition: 'Va en cursiva: algunos hablantes lo pronuncian y otros no.',
    group: 'Fonética',
  },
  'function-word': {
    term: 'Palabra gramatical (function word)',
    definition:
      'Artículos, preposiciones, auxiliares, pronombres y conjunciones. En una oración casi siempre van sin acento, en forma débil.',
    group: 'Fonética',
  },
  'forma-debil': {
    term: 'Forma débil',
    definition:
      'Cómo suena una palabra gramatical cuando no lleva énfasis: «to» es /tə/ en «I want to go».',
    group: 'Fonética',
  },
  'forma-fuerte': {
    term: 'Forma fuerte',
    definition:
      'Cómo suena una palabra gramatical cuando se enfatiza, cuando va al final o cuando se dice sola: «to» es /tuː/ en «Who are you talking to?».',
    group: 'Fonética',
  },
  'habla-conectada': {
    term: 'Habla conectada',
    definition:
      'Los cambios que sufren las palabras cuando se dicen seguidas, dentro de una oración, y no de a una.',
    group: 'Fonética',
  },
  'r-enlace': {
    term: 'R de enlace',
    definition:
      'La r final no suena en RP, pero sí cuando la palabra siguiente empieza con vocal: far /fɑː/, far away /fɑːr əˈweɪ/.',
    group: 'Fonética',
  },
  'procesos-habla': {
    term: 'Procesos del habla conectada',
    definition:
      'Asimilación (ten boys /tem bɔɪz/), elisión (next day /neks deɪ/), coalescencia (would you /wʊdʒu/) y r intrusiva (law and order /lɔːr ənd/). Son optativos y más frecuentes en el habla rápida.',
    group: 'Fonética',
  },
  'par-minimo': {
    term: 'Par mínimo',
    definition:
      'Dos palabras que se diferencian en un solo sonido, como ship /ʃɪp/ y sheep /ʃiːp/.',
    group: 'Fonética',
  },
  confirmada: {
    term: 'Pronunciación confirmada',
    definition:
      'Coincide con la del diccionario Longman. Queda guardada en esta computadora y se puede consultar sin internet.',
    group: 'La app',
  },
  estimada: {
    term: 'Pronunciación estimada',
    definition:
      'Sale del diccionario que trae la app y todavía no se comparó con Longman. Se confirma sola al abrir la palabra con internet.',
    group: 'La app',
  },
  'por-regla': {
    term: 'Formada por regla',
    definition:
      'La app la armó a partir de otra palabra que conoce, por ejemplo el plural o el pasado: waters = water + /z/.',
    group: 'La app',
  },
  clausula: {
    term: 'Cláusula',
    definition:
      'Unidad que se organiza alrededor de un verbo, normalmente con su sujeto. Una oración puede tener una o varias.',
    group: 'Gramática',
  },
  'tipos-oracion': {
    term: 'Oración simple, compuesta y compleja',
    definition:
      'Simple: una sola cláusula. Compuesta: cláusulas coordinadas (and, but, or). Compleja: una principal y al menos una subordinada.',
    group: 'Gramática',
  },
  elementos: {
    term: 'Elementos de la cláusula (SVOCA)',
    definition:
      'Las funciones de las partes de una cláusula: sujeto (S), verbo (V), objeto (O), complemento (C) y adverbial (A).',
    group: 'Gramática',
  },
  objeto: {
    term: 'Objeto directo e indirecto',
    definition:
      'El directo es lo que recibe la acción (She wrote a letter); el indirecto, casi siempre una persona, la recibe de forma indirecta (She wrote him a letter).',
    group: 'Gramática',
  },
  complemento: {
    term: 'Complemento del sujeto y del objeto',
    definition:
      'Describe o identifica al sujeto (She is a doctor) o al objeto (They painted the wall white).',
    group: 'Gramática',
  },
  adverbial: {
    term: 'Adverbial',
    definition:
      'Agrega circunstancias: cuándo, dónde, cómo, por qué. Casi siempre es opcional; si el verbo lo exige (She put it on the table), es obligatorio.',
    group: 'Gramática',
  },
  'tipos-clausula': {
    term: 'Los siete tipos de cláusula',
    definition:
      'Las combinaciones de elementos que pide el verbo, según Quirk: SV, SVO, SVC, SVA, SVOO, SVOC y SVOA.',
    group: 'Gramática',
  },
  frase: {
    term: 'Frase (NP, VP, AdjP, AdvP, PP)',
    definition:
      'Grupo de palabras alrededor de un núcleo: nominal (NP), verbal (VP), adjetiva (AdjP), adverbial (AdvP) o preposicional (PP).',
    group: 'Gramática',
  },
  'grupo-verbal': {
    term: 'Grupo verbal',
    definition: 'El verbo léxico con sus auxiliares: might have been working.',
    group: 'Gramática',
  },
  aspecto: {
    term: 'Aspecto',
    definition:
      'Perfect (have + -ed) mira la acción desde un momento posterior; progressive (be + -ing) la muestra en curso.',
    group: 'Gramática',
  },
  voz: {
    term: 'Voz activa y pasiva',
    definition:
      'En la pasiva (be + -ed) el sujeto recibe la acción en lugar de hacerla: The bridge was built in 1890.',
    group: 'Gramática',
  },
  modalidad: {
    term: 'Modalidad',
    definition:
      'Los modales (can, must, should, might…) expresan posibilidad, obligación, permiso o deducción.',
    group: 'Gramática',
  },
  finito: {
    term: 'Finito y no finito',
    definition:
      'El grupo verbal finito marca tiempo (works, worked); el no finito, no: to work, working, worked.',
    group: 'Gramática',
  },
  'tipos-sujeto': {
    term: 'Sujeto expreso, implícito y elíptico',
    definition:
      'Expreso: está escrito. Implícito: no se escribe pero se entiende, como el «you» de las imperativas (Sit down). Elíptico: se omite porque es el mismo de la cláusula anterior (She came in and sat down).',
    group: 'Gramática',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
