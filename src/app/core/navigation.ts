import { computed, inject, Injectable, signal } from '@angular/core';
import type { IconName } from '../shared/icon';
import { PreferencesService } from './preferences.service';

export type Section = 'phonetics' | 'grammar';

export type ToolView =
  | 'spelling'
  | 'keyboard'
  | 'sentence'
  | 'dictation'
  | 'pairs'
  | 'analysis'
  | 'verb-phrases'
  | 'irregular'
  | 'exercises';

export type View = 'home' | ToolView | 'help' | 'about';

export interface ToolInfo {
  id: ToolView;
  section: Section;
  /** Nombre en el menú lateral. */
  label: string;
  /** Título de la pantalla. */
  title: string;
  /** Para qué sirve, en una línea. */
  objective: string;
  /** Resumen corto para la tarjeta de la pantalla de inicio. */
  summary: string;
  /** Paso a paso (tres pasos cortos). */
  steps: readonly string[];
  icon: IconName;
  /** Actividades de práctica (en el inicio van en «Practicar»; el resto en «Consultar»). */
  practice?: boolean;
}

export const SECTIONS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'phonetics', label: 'Fonética' },
  { id: 'grammar', label: 'Gramática' },
];

export const TOOLS: readonly ToolInfo[] = [
  {
    id: 'spelling',
    section: 'phonetics',
    label: 'Buscar palabra',
    title: 'Buscar una palabra',
    objective: 'Encontrá cómo se pronuncia una palabra en inglés británico y escuchala.',
    summary: 'Pronunciación británica y americana, con audio',
    steps: [
      'Escribí la palabra. Si no sabés cómo se escribe, probá igual: te mostramos las parecidas.',
      'Elegí la que buscabas, con el mouse o con ↑ ↓ y Enter.',
      'Escuchala y mirá qué sonido corresponde a cada símbolo.',
    ],
    icon: 'search',
  },
  {
    id: 'keyboard',
    section: 'phonetics',
    label: 'Teclado fonético',
    title: 'Escribir cómo suena',
    objective:
      'Armá con los símbolos fonéticos cómo creés que suena una palabra y descubrí cuál es.',
    summary: 'Escribí con símbolos y encontrá la palabra',
    steps: [
      'Tocá los símbolos en el orden en que suenan.',
      'Mirá las palabras que suenan igual o parecido: en color, lo que cambia.',
      'Clic derecho en un símbolo para escuchar una palabra de ejemplo.',
    ],
    icon: 'keyboard',
  },
  {
    id: 'sentence',
    section: 'phonetics',
    label: 'Transcribir oración',
    title: 'Transcribir una oración',
    objective:
      'Mirá cómo se pronuncia una oración completa: las palabras gramaticales cambian según el énfasis.',
    summary: 'Formas débiles y fuertes, habla conectada',
    steps: [
      'Escribí una oración en inglés y apretá Enter.',
      'Mirá qué palabras van en forma débil y cuáles en forma fuerte.',
      'Clic en una palabra para estudiarla; doble clic para escucharla.',
    ],
    icon: 'message',
  },
  {
    id: 'dictation',
    section: 'phonetics',
    label: 'Dictado',
    title: 'Dictado fonético',
    objective: 'Escuchá una palabra o una frase y escribí su transcripción.',
    summary: 'Escuchá y transcribí con el teclado',
    steps: [
      'Elegí el nivel y apretá Empezar.',
      'Escuchá y escribí lo que oís con los símbolos del teclado.',
      'Comprobá tu respuesta: si algo no está bien, te damos una pista.',
    ],
    icon: 'headphones',
    practice: true,
  },
  {
    id: 'pairs',
    section: 'phonetics',
    label: 'Pares mínimos',
    title: 'Pares mínimos',
    objective: 'Aprendé a distinguir dos sonidos que en castellano suenan igual.',
    summary: 'Distinguí sonidos parecidos: ship o sheep',
    steps: [
      'Elegí un par de sonidos de la lista.',
      'Escuchá la palabra.',
      'Elegí cuál de las dos escuchaste.',
    ],
    icon: 'pairs',
    practice: true,
  },
  {
    id: 'analysis',
    section: 'grammar',
    label: 'Analizar oración',
    title: 'Analizar una oración',
    objective: 'Descubrí la estructura de una oración: sus cláusulas, sus elementos y sus frases.',
    summary: 'Sujeto, verbo, objetos, complementos y adverbiales',
    steps: [
      'Escribí una oración o elegí uno de los ejemplos.',
      'Mirá cada cláusula con sus elementos: sujeto, verbo, objetos, complementos y adverbiales.',
      'Clic en un elemento para ver cómo está formado por dentro.',
    ],
    icon: 'lines',
  },
  {
    id: 'verb-phrases',
    section: 'grammar',
    label: 'Grupo verbal',
    title: 'El grupo verbal',
    objective: 'Desarmá un grupo verbal en sus partes y conocé su tiempo, aspecto y voz.',
    summary: 'Tiempo, aspecto, voz y modalidad',
    steps: [
      'Escribí una oración o elegí uno de los ejemplos.',
      'Mirá cada parte con su color: auxiliares y verbo léxico.',
      'Leé el nombre de la forma, por ejemplo present perfect progressive.',
    ],
    icon: 'clock',
  },
  {
    id: 'irregular',
    section: 'grammar',
    label: 'Verbos irregulares',
    title: 'Verbos irregulares',
    objective:
      'Consultá y practicá las tres formas de los verbos irregulares y cómo se pronuncian.',
    summary: 'Formas, pronunciación y terminaciones -s / -ed',
    steps: [
      'Buscá un verbo o filtrá por patrón.',
      'Clic en una forma para escucharla.',
      'Practicá: escribí el pasado y el participio.',
    ],
    icon: 'table',
  },
  {
    id: 'exercises',
    section: 'grammar',
    label: 'Ejercicios',
    title: 'Ejercicios de análisis',
    objective: 'Practicá el análisis de cláusulas: funciones, sujeto y tipo de cláusula.',
    summary: 'Funciones y tipos de cláusula',
    steps: [
      'Elegí la función de cada parte de la cláusula.',
      'Decí cómo es el sujeto y elegí el tipo de cláusula.',
      'Comprobá: si algo no está bien, te marcamos qué revisar.',
    ],
    icon: 'exercise',
    practice: true,
  },
];

export function toolInfo(view: string | null | undefined): ToolInfo | undefined {
  return TOOLS.find((t) => t.id === view);
}

/**
 * Qué pantalla se ve. Las que ya se abrieron quedan montadas (sólo se ocultan) para no perder
 * lo escrito al cambiar; las que nunca se abrieron no se crean, así la app arranca liviana.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly prefs = inject(PreferencesService);

  readonly view = signal<View>('home');
  readonly opened = signal<ReadonlySet<View>>(new Set(['home']));
  readonly tool = computed(() => toolInfo(this.view()));
  /** Última herramienta usada, también en sesiones anteriores («Seguí donde dejaste»). */
  readonly lastTool = computed(() => toolInfo(this.prefs.lastView()));

  go(view: View): void {
    this.view.set(view);
    if (!this.opened().has(view)) this.opened.update((set) => new Set([...set, view]));
    if (toolInfo(view)) {
      this.prefs.lastView.set(view);
      this.prefs.markSeen(view);
    }
  }

  isOpen(view: View): boolean {
    return this.opened().has(view);
  }
}
