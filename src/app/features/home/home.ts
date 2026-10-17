import { Component, computed, inject, signal } from '@angular/core';
import { PHONEMES } from '../../../../shared/phoneme-inventory';
import { AudioPlayerService } from '../../core/audio-player.service';
import { NavigationService, ToolInfo, TOOLS } from '../../core/navigation';
import { describePhoneme, PhonemeExamplesService } from '../../core/phoneme-examples.service';
import { PreferencesService } from '../../core/preferences.service';
import { Icon } from '../../shared/icon';
import { Term } from '../../shared/term';

/** Los 44 fonemas del RP (sin las vocales débiles), para el «sonido del día». */
const DAILY_PHONEMES = PHONEMES.filter((p) => p.category !== 'weak-vowel');

/**
 * Pantalla de inicio: qué se puede hacer (consultar o practicar), por dónde seguir y un sonido
 * para repasar cada día. La primera vez muestra una bienvenida corta.
 */
@Component({
  selector: 'app-home',
  imports: [Icon, Term],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly nav = inject(NavigationService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly audio = inject(AudioPlayerService);
  private readonly examples = inject(PhonemeExamplesService);

  protected readonly consult = TOOLS.filter((t) => !t.practice);
  protected readonly practice = TOOLS.filter((t) => t.practice);

  protected readonly sound = signal(DAILY_PHONEMES[dayNumber() % DAILY_PHONEMES.length]);
  protected readonly soundDescription = computed(() => describePhoneme(this.sound()));
  protected readonly soundKey = computed(() => this.examples.key(this.sound()));
  protected readonly soundError = signal<string | null>(null);

  protected open(tool: ToolInfo): void {
    this.nav.go(tool.id);
  }

  protected async playSound(): Promise<void> {
    this.soundError.set(null);
    try {
      await this.examples.play(this.sound());
    } catch {
      this.soundError.set(`No se pudo reproducir «${this.sound().example}».`);
    }
  }

  /** Otro sonido al azar, para seguir repasando. */
  protected anotherSound(): void {
    const others = DAILY_PHONEMES.filter((p) => p !== this.sound());
    this.sound.set(others[Math.floor(Math.random() * others.length)]);
    this.soundError.set(null);
  }
}

/** Número de día local: el sonido cambia a la medianoche. */
function dayNumber(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}
