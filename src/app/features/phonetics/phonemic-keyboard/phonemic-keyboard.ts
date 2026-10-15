import { Component, computed, HostListener, inject, input, signal } from '@angular/core';
import type { PhonemeMatch } from '../../../../../shared/fonetica-api';
import type { PhonemeInfo } from '../../../../../shared/phoneme-inventory';
import { AudioPlayerService } from '../../../core/audio-player.service';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { PhonemeExamplesService } from '../../../core/phoneme-examples.service';
import { AlignmentView } from '../../../shared/alignment-view';
import { Icon } from '../../../shared/icon';
import { IpaText } from '../../../shared/ipa-text';
import { SourceBadge } from '../../../shared/source-badge';
import { Term } from '../../../shared/term';
import { WordDetail } from '../../../shared/word-detail/word-detail';
import { IpaKeyboard } from './ipa-keyboard';

/**
 * Fonética → Teclado fonético: el alumno escribe con símbolos cómo cree que suena una palabra.
 * Se compara contra todo el diccionario local y se muestran primero las coincidencias
 * exactas (homófonos) y después las más cercanas, marcando fonema por fonema qué cambió.
 */
@Component({
  selector: 'app-phonemic-keyboard',
  imports: [IpaKeyboard, IpaText, AlignmentView, WordDetail, Icon, SourceBadge, Term],
  templateUrl: './phonemic-keyboard.html',
  styleUrl: './phonemic-keyboard.css',
})
export class PhonemicKeyboard {
  protected readonly api = inject(FoneticaApiService);
  private readonly audio = inject(AudioPlayerService);
  private readonly examplesAudio = inject(PhonemeExamplesService);

  /** Si la pestaña está visible (las dos quedan montadas para no perder lo escrito). */
  readonly active = input(false);

  /** Lo escrito, fonema por fonema: así Retroceso borra un fonema entero (aɪ, tʃ…). */
  protected readonly tokens = signal<string[]>([]);
  protected readonly useStress = signal(false);
  protected readonly matches = signal<PhonemeMatch[]>([]);
  protected readonly selected = signal<PhonemeMatch | null>(null);
  protected readonly exampleMessage = signal<string | null>(null);

  protected readonly written = computed(() => this.tokens().join(''));
  protected readonly exact = computed(() => this.matches().filter((m) => m.exact));
  protected readonly near = computed(() => this.matches().filter((m) => !m.exact));
  /** «Probá con»: una palabra conocida y una con el error típico de vocal. */
  protected readonly examples: readonly string[][] = [
    ['k', 'æ', 't'],
    ['ʃ', 'iː', 'p'],
    ['ð', 'ɪ', 's'],
  ];

  private searchId = 0;

  protected press(symbol: string): void {
    this.tokens.update((t) => [...t, symbol]);
    void this.search();
  }

  protected backspace(): void {
    this.tokens.update((t) => t.slice(0, -1));
    void this.search();
  }

  protected clear(): void {
    this.tokens.set([]);
    this.selected.set(null);
    void this.search();
  }

  protected toggleStress(): void {
    this.useStress.update((v) => !v);
    void this.search();
  }

  protected useExample(tokens: readonly string[]): void {
    this.tokens.set([...tokens]);
    this.selected.set(null);
    void this.search();
  }

  protected select(match: PhonemeMatch): void {
    this.selected.set(match);
  }

  /** La voz británica pronuncia lo que escribió el alumno, para que compare con la palabra real. */
  protected async speakWritten(): Promise<void> {
    if (!this.tokens().length) return;
    try {
      const wav = await this.api.speakPhonemes(this.written(), { slow: this.audio.slow() });
      await this.audio.playVoice(wav, 'written');
    } catch {
      this.exampleMessage.set('No se pudo generar la voz.');
    }
  }

  /** Clic derecho en una tecla: se escucha la palabra de ejemplo de ese sonido. */
  protected async playExample(p: PhonemeInfo): Promise<void> {
    this.exampleMessage.set(`/${p.symbol}/ como en «${p.example}»…`);
    try {
      await this.examplesAudio.play(p);
      this.exampleMessage.set(`/${p.symbol}/ como en «${p.example}»`);
    } catch {
      this.exampleMessage.set(`No hay audio de «${p.example}» por ahora.`);
    }
  }

  /** Retroceso y Esc del teclado físico también funcionan, si no se está escribiendo en un campo. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.active()) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (event.key === 'Escape') {
      this.clear();
    }
  }

  protected closeness(distance: number): string {
    if (distance <= 0.6) return 'muy cerca';
    if (distance <= 1.5) return 'cerca';
    return 'más lejos';
  }

  /** Después de consultar Longman la palabra elegida pasa a compararse con la transcripción de Longman. */
  protected refresh(): void {
    void this.search();
  }

  private async search(): Promise<void> {
    const id = ++this.searchId;
    const tokens = this.tokens();
    const matches = tokens.length
      ? await this.api.searchPhonemes(tokens, { useStress: this.useStress(), limit: 40 })
      : [];
    if (id !== this.searchId) return;
    this.matches.set(matches);
  }
}
