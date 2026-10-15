/**
 * Tipos del análisis gramatical según Quirk / Greenbaum (A Student's Grammar of the English
 * Language): elementos de la cláusula SVOCA, frases (NP, VP, AdjP, AdvP, PP), tipos de cláusula
 * y de oración, y el análisis del grupo verbal. Los usan el motor (electron/grammar) y la interfaz.
 */

/** Elementos de la cláusula: Subject, Verb, Object (directo/indirecto), Complement (del sujeto/del objeto), Adverbial. */
export type ElementRole = 'S' | 'V' | 'Od' | 'Oi' | 'Cs' | 'Co' | 'A';

export type PhraseForm = 'NP' | 'VP' | 'AdjP' | 'AdvP' | 'PP' | 'clause' | 'other';

/** Rango de tokens [start, end). */
export interface TokenSpan {
  start: number;
  end: number;
}

export interface GrammarToken {
  text: string;
  /** Espacio que sigue al token en el texto original. */
  ws: string;
  lemma: string;
  /** Clase de palabra (etiqueta universal de spaCy: NOUN, VERB…). */
  pos: string;
  /** Etiqueta detallada (Penn Treebank: NNS, VBD…). */
  tag: string;
  /** Clase de palabra según Quirk, en castellano. */
  wordClass: string;
}

export type StructurePartRole =
  | 'determinante'
  | 'premodificador'
  | 'núcleo'
  | 'posmodificador'
  | 'preposición'
  | 'complemento preposicional';

/** Estructura interna de una frase: NP (det + premod + núcleo + posmod), PP (prep + complemento)… */
export interface StructurePart {
  role: StructurePartRole;
  span: TokenSpan;
  text: string;
  /** Si la parte es una cláusula (relativa, no finita…), su análisis. */
  clause?: ClauseAnalysis;
}

export interface ClauseElement {
  role: ElementRole;
  /** Desde el primer hasta el último token del elemento. */
  span: TokenSpan;
  /** Sólo si el elemento está partido (el verbo en «Have you ever been…?»): sus pedazos. */
  pieces?: TokenSpan[];
  text: string;
  form: PhraseForm;
  /** p. ej. "frase nominal (NP)" o "cláusula nominal finita". */
  formLabel: string;
  /** Sólo adverbiales: obligatorio en el patrón (SVA, SVOA) u opcional. */
  obligatory?: boolean;
  /** Aclaración para el alumno (sujeto vacío "there", agente de la pasiva…). */
  note?: string;
  structure?: StructurePart[];
  clause?: ClauseAnalysis;
}

export type VerbPartRole =
  | 'modal'
  | 'auxiliar de perfecto'
  | 'auxiliar de progresivo'
  | 'auxiliar de pasiva'
  | 'auxiliar do'
  | 'marca de infinitivo'
  | 'negación'
  | 'verbo léxico'
  | 'partícula';

export interface VerbPhraseAnalysis {
  span: TokenSpan;
  text: string;
  parts: Array<{ text: string; role: VerbPartRole }>;
  finite: boolean;
  /** Sólo no finitos. */
  nonFiniteForm?: 'to-infinitive' | 'bare infinitive' | '-ing participle' | '-ed participle';
  tense?: 'present' | 'past';
  modal?: string;
  perfect: boolean;
  progressive: boolean;
  passive: boolean;
  negative: boolean;
  imperative: boolean;
  /** En inglés, como se nombra en clase: "present perfect progressive passive". */
  label: string;
  /** Explicación en castellano. */
  description: string;
}

export type ClauseKind =
  | 'independiente'
  | 'coordinada'
  | 'nominal'
  | 'adverbial'
  | 'relativa'
  | 'posmodificadora no finita';

export interface ClauseAnalysis {
  kind: ClauseKind;
  finiteness: 'finita' | 'no finita';
  /** "cláusula adverbial finita introducida por «when»". */
  label: string;
  span: TokenSpan;
  text: string;
  subordinator?: string;
  /** Coordinante que la une a la anterior (and, but, or). */
  coordinator?: string;
  elements: ClauseElement[];
  /** Uno de los siete tipos de Quirk: SV, SVO, SVC, SVA, SVOO, SVOC, SVOA. */
  pattern: string;
  patternNote?: string;
  verbPhrase?: VerbPhraseAnalysis;
}

export type SentenceStructure = 'simple' | 'compuesta' | 'compleja' | 'compuesta-compleja';
export type SentenceForm = 'declarativa' | 'interrogativa' | 'imperativa' | 'exclamativa';

export interface SentenceGrammar {
  span: TokenSpan;
  text: string;
  structure: SentenceStructure;
  form: SentenceForm;
  /** Las cláusulas independientes (más de una si la oración es compuesta). */
  clauses: ClauseAnalysis[];
  /** Todos los grupos verbales de la oración, en orden. */
  verbPhrases: VerbPhraseAnalysis[];
  subordinateClauses: number;
}

export interface GrammarAnalysis {
  tokens: GrammarToken[];
  sentences: SentenceGrammar[];
}

export const ELEMENT_NAMES: Readonly<Record<ElementRole, string>> = {
  S: 'Sujeto (Subject)',
  V: 'Verbo (Verb)',
  Od: 'Objeto directo (Direct Object)',
  Oi: 'Objeto indirecto (Indirect Object)',
  Cs: 'Complemento del sujeto (Subject Complement)',
  Co: 'Complemento del objeto (Object Complement)',
  A: 'Adverbial',
};

/** Los siete tipos de cláusula de Quirk con un ejemplo propio de cada uno. */
export const CLAUSE_PATTERNS: ReadonlyArray<{
  pattern: string;
  description: string;
  example: string;
}> = [
  { pattern: 'SV', description: 'verbo intransitivo', example: 'The children were sleeping.' },
  {
    pattern: 'SVO',
    description: 'verbo transitivo (monotransitivo)',
    example: 'She reads novels.',
  },
  {
    pattern: 'SVC',
    description: 'verbo copulativo + complemento del sujeto',
    example: 'The soup tasted delicious.',
  },
  {
    pattern: 'SVA',
    description: 'verbo + adverbial obligatorio',
    example: 'My keys are in the drawer.',
  },
  {
    pattern: 'SVOO',
    description: 'verbo ditransitivo: objeto indirecto + directo',
    example: 'He sent his sister a postcard.',
  },
  {
    pattern: 'SVOC',
    description: 'transitivo complejo: objeto + complemento del objeto',
    example: 'They painted the walls white.',
  },
  {
    pattern: 'SVOA',
    description: 'transitivo complejo: objeto + adverbial obligatorio',
    example: 'She put the keys on the table.',
  },
];
