import { Component, inject, OnInit, signal } from '@angular/core';
import { MINIMAL_PAIRS, MinimalPairSet } from '../../../../../shared/study-data/phonetics-practice';
import { AudioPlayerService } from '../../../core/audio-player.service';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { IpaText } from '../../../shared/ipa-text';

interface Round {
  pair: [string, string];
  /** Cuál de las dos suena (0 o 1). */
  answer: number;
  chosen: number | null;
}

/**
 * Fonética → Pares mínimos: suena una de dos palabras que difieren en un solo fonema y el
 * alumno elige cuál fue. Usa la grabación real de Longman si la hay; si no, la voz británica.
 */
@Component({
  selector: 'app-minimal-pairs',
  imports: [IpaText],
  templateUrl: './minimal-pairs.html',
  styleUrl: './minimal-pairs.css',
})
export class MinimalPairs implements OnInit {
  protected readonly api = inject(FoneticaApiService);
  private readonly audio = inject(AudioPlayerService);

  protected readonly sets = MINIMAL_PAIRS;
  protected readonly set = signal<MinimalPairSet>(MINIMAL_PAIRS[0]);
  protected readonly round = signal<Round | null>(null);
  protected readonly score = signal({ right: 0, total: 0 });
  protected readonly prons = signal<Record<string, string>>({});
  protected readonly syntheticOnly = signal(false);
  protected readonly message = signal<string | null>(null);

  /** Grabaciones de Longman ya buscadas (null = no hay, se usa la voz británica). */
  private readonly recordings = new Map<string, string | null>();

  async ngOnInit(): Promise<void> {
    const words = [...new Set(MINIMAL_PAIRS.flatMap((s) => s.pairs.flat()))];
    const found = await this.api.pronsOf(words).catch(() => ({}) as Record<string, null>);
    this.prons.set(
      Object.fromEntries(
        Object.entries(found)
          .filter(([, v]) => v)
          .map(([w, v]) => [w, v!.prons[0].split(',')[0].trim()]),
      ),
    );
  }

  protected chooseSet(set: MinimalPairSet): void {
    this.set.set(set);
    this.score.set({ right: 0, total: 0 });
    void this.next();
  }

  protected async next(): Promise<void> {
    const pairs = this.set().pairs;
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    this.round.set({ pair, answer: Math.random() < 0.5 ? 0 : 1, chosen: null });
    await this.playAnswer();
  }

  protected async playAnswer(): Promise<void> {
    const round = this.round();
    if (round) await this.say(round.pair[round.answer]);
  }

  protected choose(index: number): void {
    const round = this.round();
    if (!round || round.chosen !== null) return;
    this.round.set({ ...round, chosen: index });
    this.score.update((s) => ({
      right: s.right + (index === round.answer ? 1 : 0),
      total: s.total + 1,
    }));
  }

  /** Grabación real de Longman si existe; si no (o si se pidió), la voz británica. */
  protected async say(word: string): Promise<void> {
    this.message.set(null);
    try {
      const url = this.syntheticOnly() ? null : await this.recording(word);
      if (url) {
        await this.audio.play(url);
        return;
      }
      const pron = this.prons()[word];
      if (!pron || !this.api.voiceAvailable()) {
        this.message.set(`No hay audio para «${word}».`);
        return;
      }
      await this.audio.playVoice(
        await this.api.speakPhonemes(pron, { slow: this.audio.slow() }),
        `pair:${word}`,
      );
    } catch {
      this.message.set('No se pudo reproducir el audio.');
    }
  }

  private async recording(word: string): Promise<string | null> {
    if (this.recordings.has(word)) return this.recordings.get(word)!;
    const lookup = await this.api.lookupLdoce(word).catch(() => null);
    const entry = lookup?.entries.find(
      (e) => e.headword.toLowerCase() === word.toLowerCase() && e.audioBrE,
    );
    const url = entry?.audioBrE ?? null;
    // Si no hubo conexión no se recuerda: se vuelve a intentar la próxima vez.
    if (lookup?.status !== 'offline') this.recordings.set(word, url);
    return url;
  }
}
