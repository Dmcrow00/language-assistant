import { Component, computed, inject, signal } from '@angular/core';
import { AudioPlayerService } from './core/audio-player.service';
import { FoneticaApiService } from './core/fonetica-api.service';
import { GrammarExercises } from './features/grammar/exercises/grammar-exercises';
import { IrregularVerbs } from './features/grammar/irregular-verbs/irregular-verbs';
import { SentenceAnalysis } from './features/grammar/sentence-analysis/sentence-analysis';
import { VerbPhrases } from './features/grammar/verb-phrases/verb-phrases';
import { Dictation } from './features/phonetics/dictation/dictation';
import { MinimalPairs } from './features/phonetics/minimal-pairs/minimal-pairs';
import { PhonemicKeyboard } from './features/phonetics/phonemic-keyboard/phonemic-keyboard';
import { SentenceTranscriber } from './features/phonetics/sentence/sentence-transcriber';
import { SpellingSearch } from './features/phonetics/spelling-search/spelling-search';

type Section = 'phonetics' | 'grammar';

type View =
  | 'spelling'
  | 'keyboard'
  | 'sentence'
  | 'dictation'
  | 'pairs'
  | 'analysis'
  | 'verb-phrases'
  | 'irregular'
  | 'exercises';

interface MenuItem {
  id: View;
  label: string;
  description: string;
}

/** Menú general (Fonética / Gramática) y sus submenús. */
const MENU: Readonly<Record<Section, { label: string; items: MenuItem[] }>> = {
  phonetics: {
    label: 'Fonética',
    items: [
      { id: 'spelling', label: 'Buscar palabra', description: 'Transcripción y audio de Longman' },
      {
        id: 'keyboard',
        label: 'Teclado fonético',
        description: 'Escribí cómo suena y buscá la palabra',
      },
      {
        id: 'sentence',
        label: 'Oración',
        description: 'Formas débiles y fuertes, habla conectada',
      },
      { id: 'dictation', label: 'Dictado', description: 'Escuchá y transcribí' },
      { id: 'pairs', label: 'Pares mínimos', description: 'Distinguí sonidos parecidos' },
    ],
  },
  grammar: {
    label: 'Gramática',
    items: [
      {
        id: 'analysis',
        label: 'Análisis de oraciones',
        description: 'SVOCA, frases y cláusulas (Quirk)',
      },
      {
        id: 'verb-phrases',
        label: 'Grupo verbal',
        description: 'Tiempo, aspecto, voz y modalidad',
      },
      {
        id: 'irregular',
        label: 'Verbos irregulares',
        description: 'Formas, pronunciación y -s / -ed',
      },
      { id: 'exercises', label: 'Ejercicios', description: 'Funciones y tipos de cláusula' },
    ],
  },
};

@Component({
  selector: 'app-root',
  imports: [
    SpellingSearch,
    PhonemicKeyboard,
    SentenceTranscriber,
    Dictation,
    MinimalPairs,
    SentenceAnalysis,
    VerbPhrases,
    IrregularVerbs,
    GrammarExercises,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly api = inject(FoneticaApiService);
  protected readonly audio = inject(AudioPlayerService);

  protected readonly sections = Object.keys(MENU) as Section[];
  protected readonly menu = MENU;
  protected readonly section = signal<Section>('phonetics');
  /** Último submenú abierto en cada sección, para volver a donde estaba. */
  private readonly lastView = signal<Record<Section, View>>({
    phonetics: 'spelling',
    grammar: 'analysis',
  });
  protected readonly view = computed(() => this.lastView()[this.section()]);

  /**
   * Las pantallas ya abiertas quedan montadas (sólo se ocultan) para no perder lo escrito al
   * cambiar; las que nunca se abrieron no se crean, así la app arranca liviana.
   */
  protected readonly opened = signal<ReadonlySet<View>>(new Set(['spelling']));

  protected selectSection(section: Section): void {
    this.section.set(section);
    this.markOpened(this.view());
  }

  protected selectView(view: View): void {
    this.lastView.update((last) => ({ ...last, [this.section()]: view }));
    this.markOpened(view);
  }

  protected isOpen(view: View): boolean {
    return this.opened().has(view);
  }

  private markOpened(view: View): void {
    if (!this.opened().has(view)) this.opened.update((set) => new Set([...set, view]));
  }
}
