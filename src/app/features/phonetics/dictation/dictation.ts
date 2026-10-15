import { Component, computed, HostListener, inject, input, signal } from '@angular/core';
import type { AlignmentStep, TranscriptionCheck } from '../../../../../shared/fonetica-api';
import { PRIMARY_STRESS, SECONDARY_STRESS } from '../../../../../shared/phoneme-inventory';
import {
  DICTATION_LEVELS,
  DictationLevel,
} from '../../../../../shared/study-data/phonetics-practice';
import { AudioPlayerService } from '../../../core/audio-player.service';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { AlignmentView } from '../../../shared/alignment-view';
import { Icon } from '../../../shared/icon';
import { IpaText } from '../../../shared/ipa-text';
import { SessionScore } from '../../../shared/session-score';
import { SourceBadge } from '../../../shared/source-badge';
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
 * answering: escribiendo · hint: el primer intento no salió y se marca qué revisar, sin dar la
 * respuesta · done: acertó o se mostró la respuesta.
 */
type Phase = 'answering' | 'hint' | 'done';

/**
 * Fonética → Dictado: se escucha una palabra o frase, el alumno la transcribe con el teclado
 * fonético y se comprueba fonema por fonema. Si no sale al primer intento, se marcan los
 * símbolos para revisar (pista) y puede corregir antes de ver la respuesta. Las frases se
 * transcriben con formas débiles.
 */
@Component({
  selector: 'app-dictation',
  imports: [IpaKeyboard, IpaText, AlignmentView, Icon, SessionScore, SourceBadge],
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
  protected readonly phase = signal<Phase>('answering');
  protected readonly attempts = signal(0);
  protected readonly result = signal<TranscriptionCheck | null>(null);
  /** Acertó (en el primer intento o después de la pista) sin ver la respuesta. */
  protected readonly solved = signal(false);
  protected readonly score = signal({ right: 0, total: 0 });
  protected readonly message = signal<string | null>(null);
  /** Sonidos que más costaron en la sesión, para repasar. */
  private readonly missed = signal<ReadonlyMap<string, number>>(new Map());

  protected readonly written = computed(() => this.tokens().join(''));
  /** Cuántos sonidos tiene la respuesta (sin contar los acentos), para la pista. */
  protected readonly soundCount = computed(
    () =>
      this.result()?.alignment.filter((s) => s.op !== 'extra' && !isStress(s.expected)).length ?? 0,
  );
  protected readonly toReview = computed(() =>
    [...this.missed()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([symbol]) => symbol),
  );

  private lastText: string | null = null;

  protected chooseLevelById(id: string): void {
    const level = DICTATION_LEVELS.find((l) => l.id === id);
    if (!level) return;
    this.level.set(level);
    void this.next();
  }

  protected async next(): Promise<void> {
    const items = this.level().items.filter((i) => i !== this.lastText);
    const text = items[Math.floor(Math.random() * items.length)];
    this.lastText = text;
    this.tokens.set([]);
    this.result.set(null);
    this.phase.set('answering');
    this.attempts.set(0);
    this.solved.set(false);
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
    if (this.phase() === 'done') return;
    this.phase.set('answering');
    this.tokens.update((t) => [...t, symbol]);
  }

  protected backspace(): void {
    if (this.phase() === 'done') return;
    this.phase.set('answering');
    this.tokens.update((t) => t.slice(0, -1));
  }

  protected clear(): void {
    if (this.phase() === 'done') return;
    this.phase.set('answering');
    this.tokens.set([]);
  }

  protected async check(): Promise<void> {
    const item = this.item();
    if (!item || !this.tokens().length || this.phase() !== 'answering') return;
    const result = await this.api.checkTranscription(this.tokens(), item.target);
    this.result.set(result);
    this.attempts.update((n) => n + 1);
    if (result.exact) {
      this.solved.set(true);
      this.finish(true);
    } else if (this.attempts() === 1) {
      this.phase.set('hint');
    } else {
      this.finish(false);
    }
  }

  /** Muestra la respuesta sin otro intento. */
  protected reveal(): void {
    const item = this.item();
    if (!item || this.phase() === 'done') return;
    if (!this.result()) {
      void this.api.checkTranscription(this.tokens(), item.target).then((r) => {
        this.result.set(r);
        this.finish(false);
      });
      return;
    }
    this.finish(false);
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
      if (this.phase() === 'done') void this.next();
      else void this.check();
    }
  }

  private finish(right: boolean): void {
    this.phase.set('done');
    this.score.update((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    if (right) return;
    const missed = (this.result()?.alignment ?? [])
      .filter((s) => (s.op === 'substituted' || s.op === 'missing') && !isStress(s.expected))
      .map((s) => s.expected!);
    if (missed.length) {
      this.missed.update((map) => {
        const next = new Map(map);
        for (const symbol of missed) next.set(symbol, (next.get(symbol) ?? 0) + 1);
        return next;
      });
    }
  }

  /** Para la pista: los símbolos del alumno, marcados, sin mostrar los correctos. */
  protected isOk(step: AlignmentStep): boolean {
    return step.op === 'match';
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

  /** Frase: la transcripción de la pantalla Oración, con formas débiles y r de enlace. */
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

function isStress(symbol: string | undefined): boolean {
  return symbol === PRIMARY_STRESS || symbol === SECONDARY_STRESS;
}
