import { Injectable, inject, signal } from '@angular/core';
import { FoneticaApiService } from './fonetica-api.service';

/**
 * Reproduce dos tipos de audio:
 * - las grabaciones de Longman (mp3 que baja el proceso main y queda en caché en disco);
 * - la voz británica de Piper (WAV generado en el equipo a partir de una transcripción).
 * El modo lento de Longman baja la velocidad de reproducción; el de Piper ya viene generado
 * más lento (alarga los fonemas), así suena más natural.
 */
@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private readonly api = inject(FoneticaApiService);
  private readonly blobUrls = new Map<string, string>();
  private current: HTMLAudioElement | null = null;

  /** Reproducción lenta, sin cambiar el tono, para escuchar con detalle. */
  readonly slow = signal(false);
  /** Qué se está reproduciendo (URL de Longman o una clave de la voz), para resaltar el botón. */
  readonly playing = signal<string | null>(null);

  /** Grabación de Longman: empieza a reproducir y vuelve enseguida. */
  async play(url: string): Promise<void> {
    await this.startLongman(url);
  }

  /** Grabación de Longman: espera a que termine (o a que se detenga), para encadenar palabras. */
  async playToEnd(url: string): Promise<void> {
    await untilEnd(await this.startLongman(url));
  }

  /** WAV de la voz británica; `key` identifica qué se está leyendo. */
  async playVoice(wav: Uint8Array, key: string): Promise<void> {
    await this.startVoice(wav, key);
  }

  async playVoiceToEnd(wav: Uint8Array, key: string): Promise<void> {
    await untilEnd(await this.startVoice(wav, key));
  }

  stop(): void {
    this.current?.pause();
    this.current = null;
    this.playing.set(null);
  }

  private async startLongman(url: string): Promise<HTMLAudioElement> {
    let blobUrl = this.blobUrls.get(url);
    if (!blobUrl) {
      const bytes = await this.api.getAudio(url);
      blobUrl = URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'audio/mpeg' }),
      );
      this.blobUrls.set(url, blobUrl);
    }
    return this.startElement(blobUrl, url, this.slow() ? 0.7 : 1);
  }

  private async startVoice(wav: Uint8Array, key: string): Promise<HTMLAudioElement> {
    const blobUrl = URL.createObjectURL(
      new Blob([wav as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }),
    );
    const audio = await this.startElement(blobUrl, key, 1);
    const release = () => URL.revokeObjectURL(blobUrl);
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('pause', release, { once: true });
    return audio;
  }

  private async startElement(src: string, key: string, rate: number): Promise<HTMLAudioElement> {
    this.stop();
    const audio = new Audio(src);
    audio.preservesPitch = true;
    audio.playbackRate = rate;
    audio.onended = () => this.playing.set(null);
    this.current = audio;
    this.playing.set(key);
    await audio.play();
    return audio;
  }
}

function untilEnd(audio: HTMLAudioElement): Promise<void> {
  if (audio.ended || audio.paused) return Promise.resolve();
  return new Promise<void>((resolve) => {
    for (const event of ['ended', 'pause', 'error'])
      audio.addEventListener(event, () => resolve(), { once: true });
  });
}
