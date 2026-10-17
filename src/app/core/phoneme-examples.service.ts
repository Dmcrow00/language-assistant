import { inject, Injectable } from '@angular/core';
import type { PhonemeInfo } from '../../../shared/phoneme-inventory';
import { LENGTH_MARK } from '../../../shared/phoneme-inventory';
import { AudioPlayerService } from './audio-player.service';
import { FoneticaApiService } from './fonetica-api.service';

/** Cómo se describe cada sonido al alumno: «vocal larga», «diptongo», «fricativa sorda»… */
export function describePhoneme(p: PhonemeInfo): string {
  switch (p.category) {
    case 'monophthong':
      if (p.symbol === 'ə') return 'schwa, vocal débil';
      return p.symbol.endsWith(LENGTH_MARK) ? 'vocal larga' : 'vocal corta';
    case 'diphthong':
      return 'diptongo';
    case 'weak-vowel':
      return 'vocal débil';
    case 'consonant':
      return `${p.keyword} ${p.voiced ? 'sonora' : 'sorda'}`;
  }
}

/**
 * Hace escuchar la palabra de ejemplo de un fonema (la de la tabla fonémica): la grabación de
 * Longman si la hay; si no, la voz de la app con la pronunciación del diccionario incluido.
 */
@Injectable({ providedIn: 'root' })
export class PhonemeExamplesService {
  private readonly api = inject(FoneticaApiService);
  private readonly audio = inject(AudioPlayerService);

  /** Clave con la que suena el ejemplo (para resaltar el botón mientras se oye). */
  key(p: PhonemeInfo): string {
    return `ejemplo:${p.symbol}`;
  }

  async play(p: PhonemeInfo): Promise<void> {
    const word = p.example.toLowerCase();
    const lookup = await this.api.lookupLdoce(p.example).catch(() => null);
    const entries = lookup?.entries ?? [];
    const url =
      entries.find((e) => e.headword.toLowerCase() === word && e.audioBrE)?.audioBrE ??
      entries.find((e) => e.audioBrE)?.audioBrE;
    if (url) {
      await this.audio.play(url);
      return;
    }
    const local = (await this.api.pronsOf([p.example]))[p.example];
    if (!local || !this.api.voiceAvailable()) throw new Error(`No hay audio de «${p.example}».`);
    const wav = await this.api.speakPhonemes(local.prons[0].split(',')[0].trim(), {
      slow: this.audio.slow(),
    });
    await this.audio.playVoice(wav, this.key(p));
  }
}
