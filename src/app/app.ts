import { Component, computed, inject } from '@angular/core';
import { AudioPlayerService } from './core/audio-player.service';
import { FoneticaApiService } from './core/fonetica-api.service';
import { NavigationService, SECTIONS, TOOLS, View } from './core/navigation';
import { PreferencesService, ThemeChoice } from './core/preferences.service';
import { About } from './features/about/about';
import { GrammarExercises } from './features/grammar/exercises/grammar-exercises';
import { IrregularVerbs } from './features/grammar/irregular-verbs/irregular-verbs';
import { SentenceAnalysis } from './features/grammar/sentence-analysis/sentence-analysis';
import { VerbPhrases } from './features/grammar/verb-phrases/verb-phrases';
import { Help } from './features/help/help';
import { Home } from './features/home/home';
import { Dictation } from './features/phonetics/dictation/dictation';
import { MinimalPairs } from './features/phonetics/minimal-pairs/minimal-pairs';
import { PhonemicKeyboard } from './features/phonetics/phonemic-keyboard/phonemic-keyboard';
import { SentenceTranscriber } from './features/phonetics/sentence/sentence-transcriber';
import { SpellingSearch } from './features/phonetics/spelling-search/spelling-search';
import { Icon, IconName } from './shared/icon';

const THEMES: ReadonlyArray<{ id: ThemeChoice; label: string; icon: IconName }> = [
  { id: 'light', label: 'Claro', icon: 'sun' },
  { id: 'dark', label: 'Oscuro', icon: 'moon' },
  { id: 'auto', label: 'Automático (como el sistema)', icon: 'monitor' },
];

/** Marco de la app: menú lateral, barra superior y la pantalla elegida. */
@Component({
  selector: 'app-root',
  imports: [
    Icon,
    Home,
    Help,
    About,
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
  protected readonly prefs = inject(PreferencesService);
  protected readonly nav = inject(NavigationService);

  protected readonly sections = SECTIONS.map((section) => ({
    ...section,
    tools: TOOLS.filter((t) => t.section === section.id),
  }));
  protected readonly themes = THEMES;

  protected readonly view = this.nav.view;
  protected readonly tool = this.nav.tool;
  protected readonly sectionLabel = computed(
    () => SECTIONS.find((s) => s.id === this.tool()?.section)?.label ?? '',
  );
  protected readonly pageLabel = computed(() => {
    const view = this.view();
    if (view === 'home') return 'Inicio';
    if (view === 'help') return 'Ayuda';
    if (view === 'about') return 'Acerca de la app';
    return this.tool()?.label ?? '';
  });
  protected readonly guideOpen = computed(() => {
    const tool = this.tool();
    return !!tool && this.prefs.isGuideOpen(tool.id);
  });

  protected go(view: View): void {
    this.nav.go(view);
  }

  protected isOpen(view: View): boolean {
    return this.nav.isOpen(view);
  }

  protected toggleGuide(): void {
    const tool = this.tool();
    if (tool) this.prefs.toggleGuide(tool.id);
  }
}
