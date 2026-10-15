import { Component, computed, HostListener, inject, input, signal } from '@angular/core';
import type { TranscriptionCheck } from '../../../../../shared/fonetica-api';
import {
  DICTATION_LEVELS,
  DictationLevel,
} from '../../../../../shared/study-data/phonetics-practice';
import { AudioPlayerService } from '../../../core/audio-player.service';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { AlignmentView } from '../../../shared/alignment-view';
import { IpaText } from '../../../shared/ipa-text';
import { IpaKeyboard } from '../phonemic-keyboard/ipa-keyboard';

interface DictationItem {
  text: string;
  /** Transcripción correcta (Longman si respondió; si no, la del diccionario local). */
  target: string;
  verified: boolean;
  /** Grabación real de Longman, si la hay (sólo palabras). */
  audioUrl?: string;
  phrase: boolean;
}

/**
 * Fonética → Dictado: se escucha una palabra o frase, el alumno la transcribe con el teclado
 * fonético y se corrige fonema por fonema. Las frases se transcriben con formas débiles.
 */
@Component({
  selector: 'app-dictation',
  imports: [IpaKeyboard, IpaText, AlignmentView],
  templateUrl: './dictation.html',
  styleUrl: './dictation.css',
})
export class Dictation {
  protected readonly api = inject(FoneticaApiService);
  private readonly audio = inject(AudioPlayerService);

  readonly active = input(false);

  protected readonly levels = DICTATION_LEVELS;
  protected readonly level = signal<DictationLevel>(DICTATION_LEVELS[0]);
  protected readonly item = signal<DictationItem | null>(null);
  protected readonly loading = signal(false);
  protected readonly tokens = signal<string[]>([]);
  protected readonly result = signal<TranscriptionCheck | null>(null);
  protected readonly score = signal({ right: 0, total: 0 });
  protected readonly message = signal<string | null>(null);

  protected readonly written = computed(() => this.tokens().join(''));
  private lastText: string | null = null;

  protected chooseLevel(level: DictationLevel): void {
    this.level.set(level);
    void this.next();
  }

  protected async next(): Promise<void> {
    const items = this.level().items.filter((i) => i !== this.lastText);
    const text = items[Math.floor(Math.random() * items.length)];
    this.lastText = text;
    this.tokens.set([]);
    this.result.set(null);
    this.message.set(null);
    this.loading.set(true);
    try {
      this.item.set(this.level().phrases ? await this.loadPhrase(text) : await this.loadWord(text));
      await this.play();
    } catch {
      this.message.set('No se pudo preparar el dictado.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async play(): Promise<void> {
    const item = this.item();
    if (!item) return;
    try {
      if (item.audioUrl) {
        await this.audio.play(item.audioUrl);
      } else if (item.phrase) {
        const wav = await this.api.speakSentence(item.text, {
          connected: true,
          forcedStrong: [],
          forcedWeak: [],
          slow: this.audio.slow(),
        });
        await this.audio.playVoice(wav, 'dictation');
      } else {
        const wav = await this.api.speakPhonemes(item.target, { slow: this.audio.slow() });
        await this.audio.playVoice(wav, 'dictation');
      }
    } catch {
      this.message.set('No se pudo reproducir el audio.');
    }
  }

  protected press(symbol: string): void {
    if (this.result()) return;
    this.tokens.update((t) => [...t, symbol]);
  }

  protected backspace(): void {
    if (!this.result()) this.tokens.update((t) => t.slice(0, -1));
  }

  protected clear(): void {
    if (!this.result()) this.tokens.set([]);
  }

  protected async check(): Promise<void> {
    const item = this.item();
    if (!item || !this.tokens().length || this.result()) return;
    const result = await this.api.checkTranscription(this.tokens(), item.target);
    this.result.set(result);
    this.score.update((s) => ({ right: s.right + (result.exact ? 1 : 0), total: s.total + 1 }));
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.active()) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.result()) void this.next();
      else void this.check();
    }
  }

  /** Palabra: se verifica en Longman (transcripción y grabación real); si no responde, la local. */
  private async loadWord(text: string): Promise<DictationItem> {
    const lookup = await this.api.lookupLdoce(text).catch(() => null);
    const entry = lookup?.entries.find(
      (e) => e.headword.toLowerCase() === text.toLowerCase() && e.pronBrE,
    );
    if (entry?.pronBrE) {
      return {
        text,
        target: entry.pronBrE,
        verified: true,
        ...(entry.audioBrE ? { audioUrl: entry.audioBrE } : {}),
        phrase: false,
      };
    }
    const local = (await this.api.pronsOf([text]))[text];
    return { text, target: local?.prons[0] ?? '', verified: false, phrase: false };
  }

  /** Frase: la transcripción de la pestaña Oración, con formas débiles y r de enlace. */
  private async loadPhrase(text: string): Promise<DictationItem> {
    const analysis = await this.api.analyzeSentence(text, {
      connected: true,
      forcedStrong: [],
      forcedWeak: [],
    });
    const target = analysis.transcription.replace(/^\/|\/$/g, '').replace(/\s*\|+\s*/g, ' ');
    return { text, target, verified: false, phrase: true };
  }
}
