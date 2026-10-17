import { Component, computed, inject, signal } from '@angular/core';
import { NavigationService } from '../../core/navigation';
import { PreferencesService } from '../../core/preferences.service';
import { GLOSSARY, GlossaryEntry } from '../../shared/glossary';
import { Icon } from '../../shared/icon';
import { IpaText } from '../../shared/ipa-text';

const GROUPS: ReadonlyArray<GlossaryEntry['group']> = ['Fonética', 'Gramática', 'La app'];

/** Ayuda: cómo leer una transcripción, atajos de teclado y el glosario completo. */
@Component({
  selector: 'app-help',
  imports: [Icon, IpaText],
  templateUrl: './help.html',
  styleUrl: './help.css',
})
export class Help {
  private readonly nav = inject(NavigationService);
  private readonly prefs = inject(PreferencesService);

  protected readonly filter = signal('');
  protected readonly groups = computed(() => {
    const q = normalize(this.filter().trim());
    const entries = Object.values(GLOSSARY) as GlossaryEntry[];
    return GROUPS.map((group) => ({
      group,
      entries: entries
        .filter((e) => e.group === group)
        .filter((e) => !q || normalize(`${e.term} ${e.definition}`).includes(q))
        .sort((a, b) => a.term.localeCompare(b.term, 'es')),
    })).filter((g) => g.entries.length);
  });

  protected showWelcome(): void {
    this.prefs.welcomeDone.set(false);
    this.nav.go('home');
  }
}

/** Sin mayúsculas ni tildes, para que «debil» encuentre «débil». */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
