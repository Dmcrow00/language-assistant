/**
 * Contrato entre la interfaz (Angular, proceso renderer) y el motor (proceso main de Electron).
 * El preload expone un objeto con esta forma en `window.fonetica`; cada método viaja por IPC.
 */

import type { GrammarAnalysis } from './grammar';

/** De dónde sale una transcripción: verificada en Longman o del diccionario abierto Britfone. */
export type PronSource = 'ldoce' | 'britfone';

/** Resultado de la búsqueda por ortografía (pestaña 1). */
export interface SpellingHit {
  word: string;
  /** Transcripciones en notación Longman; los sonidos opcionales van entre paréntesis. */
  prons: string[];
  source: PronSource;
  /** exact = coincide; prefix = la palabra empieza así; fuzzy = parecida (posible error de tipeo). */
  kind: 'exact' | 'prefix' | 'fuzzy';
  score: number;
}

/**
 * Un paso de la comparación entre lo que escribió el alumno y la transcripción del diccionario.
 * - match: el fonema coincide.
 * - substituted: el diccionario tiene `expected` y el alumno escribió `written`.
 * - missing: el diccionario tiene `expected` y el alumno no lo escribió.
 * - extra: el alumno escribió `written` y la palabra no lo tiene.
 */
export interface AlignmentStep {
  op: 'match' | 'substituted' | 'missing' | 'extra';
  expected?: string;
  written?: string;
}

/** Resultado de la búsqueda por fonemas (pestaña 2). */
export interface PhonemeMatch {
  word: string;
  /** La variante de pronunciación que más se acercó. */
  pron: string;
  source: PronSource;
  distance: number;
  /** Misma secuencia de fonemas (homófonos de lo escrito). */
  exact: boolean;
  /** El alumno marcó el acento principal en otra sílaba (sólo si pidió tener en cuenta el acento). */
  stressMismatch: boolean;
  alignment: AlignmentStep[];
}

export interface PhonemeSearchOptions {
  /** Si es true, marcar el acento en otra sílaba suma distancia. */
  useStress: boolean;
  limit?: number;
}

/**
 * Una de las formas que Longman separa con etiquetas. En las function words la primera (sin
 * etiqueta) es la débil: the /ðə; before vowels ði; strong ðiː/.
 */
export interface LdocePronForm {
  /** Etiqueta tal como la escribe Longman ("strong", "before vowels"…); sin etiqueta = la habitual. */
  label?: string;
  pron: string;
}

/** Una entrada de Longman tal como aparece en la página de la palabra. */
export interface LdoceEntry {
  headword: string;
  homnum?: string;
  pos?: string;
  /** Pronunciación británica (RP). Sonidos opcionales entre paréntesis, como la cursiva de Longman. */
  pronBrE?: string;
  /** Sólo si Longman da más de una forma etiquetada (débil / fuerte / ante vocal). */
  pronFormsBrE?: LdocePronForm[];
  /** Variante americana, si Longman la indica (en la página aparece después de "$"). */
  pronAmE?: string;
  audioBrE?: string;
  audioAmE?: string;
  definition?: string;
}

export type LdoceStatus = 'found' | 'suggestions' | 'not-found' | 'offline';

export interface LdoceLookup {
  query: string;
  status: LdoceStatus;
  entries: LdoceEntry[];
  /** Sugerencias de Longman cuando la palabra no existe ("Did you mean…?"). */
  suggestions: string[];
  pageUrl?: string;
  fetchedAt?: string;
  fromCache: boolean;
  /** Detalle del error cuando status = offline. */
  message?: string;
}

/** Forma de una function word dentro de la oración. */
export type WordStrength = 'weak' | 'strong';

/** Información de una function word (artículos, preposiciones, auxiliares, pronombres…). */
export interface FunctionWordInfo {
  category: string;
  form: WordStrength;
  /** Formas débiles; la primera es la habitual ante consonante. */
  weak: string[];
  /** Forma débil ante vocal, si es distinta (the → ði, to → tʊ). */
  weakBeforeVowel?: string;
  strong: string;
  /** Por qué se eligió esa forma, para mostrarle al alumno. */
  reason: string;
  /** La forma la eligió el alumno (enfatizada → fuerte, o sin énfasis → débil). */
  forced: boolean;
  /** Aviso cuando la forma depende del sentido (that demostrativo o conjunción, have auxiliar o verbo…). */
  ambiguous?: string;
  /** true si las formas salen de Longman; false si salen de la tabla de referencia (Roach). */
  fromLongman: boolean;
}

/** Una palabra de la oración ya transcripta. */
export interface SentenceWord {
  /** Posición entre las palabras de la oración (0, 1, 2…). */
  index: number;
  /** Tal como la escribió el alumno. */
  text: string;
  /** Posición en el texto original. */
  start: number;
  end: number;
  /** Clave para consultar Longman y el diccionario local (minúsculas). */
  key: string;
  /** Transcripción usada en la oración; null si no se encontró. */
  pron: string | null;
  /** derived = armada a partir de otra palabra (cats ← cat + -s); rule = tabla de function words. */
  source: PronSource | 'derived' | 'rule' | null;
  /** Explicación de la transcripción cuando es derivada. */
  note?: string;
  alternatives: string[];
  /** Se agrega una /r/ de enlace porque la palabra siguiente empieza con vocal (far‿away). */
  linkingR: boolean;
  functionWord?: FunctionWordInfo;
  /** Pausa después de la palabra: | menor (coma), || mayor (fin de oración). */
  pauseAfter?: '|' | '||';
  /** Transcripción con los procesos del habla conectada aplicados (sólo si cambia). */
  connectedPron?: string;
}

/** Procesos del habla conectada entre una palabra y la siguiente. Todos son optativos en RP. */
export type ConnectedProcessKind =
  'linking-r' | 'intrusive-r' | 'elision' | 'assimilation' | 'coalescence';

export interface ConnectedProcess {
  kind: ConnectedProcessKind;
  /** Palabra en la que empieza el proceso (la siguiente también puede cambiar). */
  wordIndex: number;
  /** Nombre del proceso en castellano. */
  label: string;
  /** Qué cambia: "/t/ → /k/ ante /k/". */
  detail: string;
  /** Las dos palabras: "that cat". */
  words: string;
}

export interface SentenceAnalysis {
  words: SentenceWord[];
  /** La oración completa entre barras, lista para copiar. */
  transcription: string;
  /** Procesos posibles del habla conectada (asimilación, elisión, r intrusiva…). */
  processes: ConnectedProcess[];
  /** La transcripción con esos procesos aplicados. */
  connectedTranscription: string;
}

export interface SentenceOptions {
  /** Habla conectada: formas débiles y r de enlace. Si es false, cada palabra en su forma de cita. */
  connected: boolean;
  /** Índices de las palabras que el alumno marcó como enfatizadas (van en forma fuerte). */
  forcedStrong: number[];
  /** Índices de las palabras que el alumno marcó sin énfasis (van en forma débil). */
  forcedWeak: number[];
}

/** Opciones de la voz sintética (Piper). */
export interface SpeechOptions {
  /** Habla más despacio (sin cambiar el tono). */
  slow: boolean;
  /** Sólo oraciones: leer con los procesos del habla conectada aplicados. */
  processes?: boolean;
}

/** Corrección de una transcripción del alumno (dictado). */
export interface TranscriptionCheck {
  exact: boolean;
  distance: number;
  alignment: AlignmentStep[];
  /** La variante de la transcripción correcta con la que se comparó. */
  expected: string;
}

/** Pronunciación de una terminación (-s, -ed) y la regla que la explica. */
export interface InflectedForm {
  spelling: string;
  pron: string;
  /** La terminación pronunciada: "/ɪz/", "/t/"… */
  ending: string;
  rule: string;
  /** true si la forma está en el diccionario; false si se armó con la regla. */
  fromDictionary: boolean;
}

export interface InflectionInfo {
  base: string;
  basePron: string | null;
  s: InflectedForm | null;
  ed: InflectedForm | null;
}

/** Tema de la ventana: el del sistema, claro u oscuro (incluye la barra de título). */
export type ThemeSource = 'system' | 'light' | 'dark';

export interface LexiconInfo {
  total: number;
  fromLdoce: number;
}

export interface FoneticaApi {
  searchSpelling(query: string, limit?: number): Promise<SpellingHit[]>;
  searchPhonemes(phonemes: string[], options: PhonemeSearchOptions): Promise<PhonemeMatch[]>;
  lookupLdoce(word: string): Promise<LdoceLookup>;
  /** Devuelve el mp3 (cacheado en disco después de la primera vez). */
  getAudio(url: string): Promise<Uint8Array>;
  /** Abre la página de Longman en el navegador del sistema. */
  openInBrowser(url: string): Promise<void>;
  lexiconInfo(): Promise<LexiconInfo>;
  /** Transcribe una oración con lo que ya se conoce (diccionario local y Longman en caché). */
  analyzeSentence(text: string, options: SentenceOptions): Promise<SentenceAnalysis>;
  /** Si la voz británica (Piper) está instalada. */
  voiceAvailable(): Promise<boolean>;
  /** Lee la oración con la voz británica tal como está transcripta (WAV). */
  speakSentence(text: string, options: SentenceOptions & SpeechOptions): Promise<Uint8Array>;
  /** Pronuncia una transcripción (notación Longman) con la voz británica (WAV). */
  speakPhonemes(pron: string, options: SpeechOptions): Promise<Uint8Array>;
  /** Pronunciaciones de varias palabras del diccionario local (null si no está). */
  pronsOf(words: string[]): Promise<Record<string, { prons: string[]; source: PronSource } | null>>;
  /** Compara lo que transcribió el alumno con la transcripción correcta (dictado). */
  checkTranscription(written: string[], expected: string): Promise<TranscriptionCheck>;
  /** Pronunciación de -s y -ed de un verbo, con la regla. */
  inflections(verb: string): Promise<InflectionInfo>;
  /** Si el analizador gramatical (spaCy) está instalado. */
  grammarAvailable(): Promise<boolean>;
  /** Análisis gramatical según Quirk / Greenbaum. */
  analyzeGrammar(text: string): Promise<GrammarAnalysis>;
  /** Cambia el tema de la ventana para que la barra de título acompañe al de la interfaz. */
  setTheme(theme: ThemeSource): Promise<void>;
}

/** Nombres de los canales IPC. El preload no puede importar este valor (corre en sandbox), sólo el tipo. */
export const IPC = {
  searchSpelling: 'lexicon:search-spelling',
  searchPhonemes: 'lexicon:search-phonemes',
  lexiconInfo: 'lexicon:info',
  lookupLdoce: 'ldoce:lookup',
  getAudio: 'ldoce:audio',
  openInBrowser: 'shell:open-in-browser',
  analyzeSentence: 'sentence:analyze',
  voiceAvailable: 'tts:available',
  speakSentence: 'tts:sentence',
  speakPhonemes: 'tts:phonemes',
  pronsOf: 'lexicon:prons-of',
  checkTranscription: 'lexicon:check-transcription',
  inflections: 'lexicon:inflections',
  grammarAvailable: 'grammar:available',
  analyzeGrammar: 'grammar:analyze',
  setTheme: 'window:set-theme',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
