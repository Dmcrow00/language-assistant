import { Component, computed, inject, signal } from '@angular/core';
import type {
  LdoceLookup,
  SentenceAnalysis,
  SentenceOptions,
  SentenceWord,
  WordStrength,
} from '../../../../../shared/fonetica-api';
import { AudioPlayerService } from '../../../core/audio-player.service';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { IpaText } from '../../../shared/ipa-text';
import { WordDetail } from '../../../shared/word-detail/word-detail';

/**
 * Pestaña 3: el alumno escribe una oración y la ve transcripta palabra por palabra, con las
 * function words en forma fuerte o débil según el contexto y la r de enlace.
 *
 * La transcripción aparece enseguida con lo que hay en el equipo y se va corrigiendo a medida
 * que responde Longman (una palabra por segundo como máximo; lo ya consultado es instantáneo).
 */
@Component({
  selector: 'app-sentence-transcriber',
  imports: [IpaText, WordDetail],
  templateUrl: './sentence-transcriber.html',
  styleUrl: './sentence-transcriber.css',
})
export class SentenceTranscriber {
  protected readonly api = inject(FoneticaApiService);
  private readonly audio = inject(AudioPlayerService);

  protected readonly text = signal('');
  /** La oración que se transcribió (el campo puede seguir editándose). */
  private readonly submitted = signal('');
  protected readonly connected = signal(true);
  /** Mostrar (y que la voz aplique) asimilación, elisión, r intrusiva y coalescencia. */
  protected readonly showProcesses = signal(false);
  /** Formas elegidas por el alumno, por índice de palabra. */
  private readonly overrides = signal<ReadonlyMap<number, WordStrength>>(new Map());
  protected readonly analysis = signal<SentenceAnalysis | null>(null);
  protected readonly selectedIndex = signal<number | null>(null);
  protected readonly progress = signal<{ done: number; total: number } | null>(null);
  protected readonly playingIndex = signal<number | null>(null);
  /** Qué se está reproduciendo: la voz británica o las grabaciones de Longman palabra por palabra. */
  protected readonly playingMode = signal<'voice' | 'words' | null>(null);
  protected readonly synthesizing = signal(false);
  protected readonly voiceError = signal<string | null>(null);
  protected readonly copied = signal(false);
  /** Consultas a Longman de esta sesión: de acá salen los audios de cada palabra. */
  private readonly lookups = signal<ReadonlyMap<string, LdoceLookup>>(new Map());

  protected readonly selectedWord = computed(() => {
    const index = this.selectedIndex();
    return index === null ? null : (this.analysis()?.words[index] ?? null);
  });
  protected readonly withAudio = computed(() => {
    this.lookups();
    return this.analysis()?.words.filter((w) => this.audioFor(w)).length ?? 0;
  });

  private generation = 0;
  private analyzeId = 0;
  private playToken = 0;
  /** Última oración generada con la voz, para no volver a generarla si se repite. */
  private voiceCache: { key: string; wav: Uint8Array } | null = null;

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.transcribe();
    }
  }

  protected async transcribe(): Promise<void> {
    const text = this.text().trim();
    if (!text) return;
    const generation = ++this.generation;
    this.stop();
    this.submitted.set(text);
    this.overrides.set(new Map());
    this.selectedIndex.set(null);
    await this.reanalyze();

    // Primero las palabras de contenido (las function words ya tienen la tabla de referencia).
    const words = this.analysis()?.words ?? [];
    const ordered = [
      ...words.filter((w) => !w.functionWord),
      ...words.filter((w) => w.functionWord),
    ];
    const keys = [...new Set(ordered.map((w) => w.key))].filter((k) => {
      // Lo que falló por falta de conexión se vuelve a intentar.
      const known = this.lookups().get(k);
      return !known || known.status === 'offline';
    });
    if (!keys.length) return;
    this.progress.set({ done: 0, total: keys.length });
    for (const key of keys) {
      const lookup = await this.api.lookupLdoce(key);
      if (generation !== this.generation) return;
      this.lookups.update((map) => new Map(map).set(key, lookup));
      this.progress.update((p) => p && { ...p, done: p.done + 1 });
      await this.reanalyze();
    }
    this.progress.set(null);
  }

  /** Procesos de la palabra (para el globo de ayuda de la tarjeta). */
  protected processesOf(index: number): string {
    return (this.analysis()?.processes ?? [])
      .filter((p) => p.wordIndex === index || p.wordIndex === index - 1)
      .map((p) => `${p.label}: ${p.detail}`)
      .join(' · ');
  }

  protected toggleConnected(): void {
    this.connected.update((v) => !v);
    void this.reanalyze();
  }

  protected select(index: number): void {
    this.selectedIndex.set(index);
  }

  /** Fuerza la forma elegida, o vuelve a la automática si ya era la elegida. */
  protected setForm(index: number, form: WordStrength | null): void {
    this.overrides.update((map) => {
      const next = new Map(map);
      if (form) next.set(index, form);
      else next.delete(index);
      return next;
    });
    void this.reanalyze();
  }

  /**
   * La voz británica (Piper) lee la oración tal como está transcripta: con las formas débiles o
   * fuertes de la pantalla, así que si el alumno enfatiza una palabra, se oye.
   */
  protected async playVoice(): Promise<void> {
    const analysis = this.analysis();
    if (!analysis) return;
    const token = ++this.playToken;
    this.audio.stop();
    this.voiceError.set(null);
    const slow = this.audio.slow();
    const processes = this.showProcesses() && this.connected();
    const key = `${processes ? analysis.connectedTranscription : analysis.transcription}|${slow}`;
    let wav = this.voiceCache?.key === key ? this.voiceCache.wav : null;
    if (!wav) {
      this.synthesizing.set(true);
      try {
        wav = await this.api.speakSentence(this.submitted(), {
          ...this.currentOptions(),
          slow,
          processes,
        });
        this.voiceCache = { key, wav };
      } catch {
        this.voiceError.set('No se pudo generar la voz.');
        return;
      } finally {
        this.synthesizing.set(false);
      }
    }
    if (token !== this.playToken) return;
    this.playingMode.set('voice');
    await this.audio.playVoiceToEnd(wav, 'sentence').catch(() => undefined);
    if (token === this.playToken) this.playingMode.set(null);
  }

  /** Encadena las grabaciones de Longman de cada palabra, resaltando la que suena. */
  protected async playWords(): Promise<void> {
    const words = this.analysis()?.words ?? [];
    const token = ++this.playToken;
    this.playingMode.set('words');
    for (const word of words) {
      if (token !== this.playToken) return;
      this.playingIndex.set(word.index);
      const url = this.audioFor(word);
      if (url) await this.audio.playToEnd(url).catch(() => undefined);
      else await wait(300);
      if (token !== this.playToken) return;
      await wait(word.pauseAfter ? 300 : 40);
    }
    this.playingIndex.set(null);
    this.playingMode.set(null);
  }

  protected async playWord(word: SentenceWord): Promise<void> {
    const url = this.audioFor(word);
    if (url) await this.audio.play(url).catch(() => undefined);
  }

  protected stop(): void {
    this.playToken++;
    this.audio.stop();
    this.playingIndex.set(null);
    this.playingMode.set(null);
  }

  protected async copy(): Promise<void> {
    const analysis = this.analysis();
    const line =
      this.showProcesses() && this.connected()
        ? analysis?.connectedTranscription
        : analysis?.transcription;
    if (!line) return;
    await navigator.clipboard.writeText(line);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  protected tag(word: SentenceWord): string {
    if (word.functionWord) {
      const label = word.functionWord.form === 'weak' ? 'débil' : 'fuerte';
      return word.functionWord.forced ? `${label} · elegida` : label;
    }
    if (word.source === 'britfone') return 'aprox.';
    if (word.source === 'derived') return 'armada';
    if (!word.pron) return 'sin datos';
    return '';
  }

  private audioFor(word: SentenceWord): string | undefined {
    return this.lookups()
      .get(word.key)
      ?.entries.find((e) => e.audioBrE)?.audioBrE;
  }

  private async reanalyze(): Promise<void> {
    const text = this.submitted();
    if (!text) return;
    const id = ++this.analyzeId;
    const result = await this.api.analyzeSentence(text, this.currentOptions());
    if (id === this.analyzeId) this.analysis.set(result);
  }

  private currentOptions(): SentenceOptions {
    const overrides = [...this.overrides()];
    return {
      connected: this.connected(),
      forcedStrong: overrides.filter(([, f]) => f === 'strong').map(([i]) => i),
      forcedWeak: overrides.filter(([, f]) => f === 'weak').map(([i]) => i),
    };
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
