import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { LdocePronForm, LdoceEntry, LdoceLookup } from '../../../../shared/fonetica-api';
import { AudioPlayerService } from '../../core/audio-player.service';
import { FoneticaApiService } from '../../core/fonetica-api.service';
import { IpaText } from '../ipa-text';

/** Entradas de Longman con la misma pronunciación (p. ej. "water" sustantivo y verbo) se muestran juntas. */
interface EntryGroup {
  headword: string;
  pronBrE?: string;
  /** Formas etiquetadas (débil / ante vocal / fuerte) de las function words. */
  forms?: LdocePronForm[];
  pronAmE?: string;
  audioBrE?: string;
  audioAmE?: string;
  senses: Array<{ pos?: string; definition?: string }>;
}

type DetailState =
  | { status: 'idle' }
  | { status: 'loading'; word: string }
  | { status: 'done'; lookup: LdoceLookup }
  | { status: 'error'; word: string; message: string };

/**
 * Ficha de una palabra según Longman: palabra, transcripción RP (y la americana), audio y
 * una definición corta para distinguir homófonos. Se usa en las dos pestañas.
 */
@Component({
  selector: 'app-word-detail',
  imports: [IpaText],
  templateUrl: './word-detail.html',
  styleUrl: './word-detail.css',
})
export class WordDetail {
  protected readonly api = inject(FoneticaApiService);
  protected readonly audio = inject(AudioPlayerService);

  /** Palabra a consultar en Longman. */
  readonly word = input<string | null>(null);
  /** Transcripción local para mostrar si Longman no responde. */
  readonly fallbackPron = input<string | null>(null);
  /** El alumno eligió una de las sugerencias de Longman. */
  readonly wordRequested = output<string>();
  /** Longman respondió con la palabra: el diccionario local ya tiene su transcripción. */
  readonly lookedUp = output<LdoceLookup>();

  protected readonly state = signal<DetailState>({ status: 'idle' });
  protected readonly audioError = signal<string | null>(null);
  private requestId = 0;

  protected readonly groups = computed<EntryGroup[]>(() => {
    const s = this.state();
    return s.status === 'done' ? groupEntries(s.lookup.entries) : [];
  });

  constructor() {
    effect(() => {
      const word = this.word();
      untracked(() => void this.load(word));
    });
  }

  protected async play(url: string | undefined): Promise<void> {
    if (!url) return;
    this.audioError.set(null);
    try {
      await this.audio.play(url);
    } catch {
      this.audioError.set('No se pudo reproducir el audio. Revisá la conexión a internet.');
    }
  }

  /** Etiquetas de Longman en castellano; la primera forma es la débil si hay una "strong". */
  protected formLabel(forms: LdocePronForm[], index: number): string {
    const label = forms[index].label ?? '';
    if (/strong/i.test(label)) return 'fuerte';
    if (/before vowel/i.test(label)) return 'débil ante vocal';
    if (!label) return forms.some((f) => this.isStrong(f)) ? 'débil' : 'habitual';
    return label;
  }

  protected isStrong(form: LdocePronForm): boolean {
    return /strong/i.test(form.label ?? '');
  }

  /** Sin audio de Longman: la voz británica pronuncia la transcripción local. */
  protected async speakFallback(pron: string): Promise<void> {
    this.audioError.set(null);
    try {
      const wav = await this.api.speakPhonemes(pron, { slow: this.audio.slow() });
      await this.audio.playVoice(wav, `fallback:${pron}`);
    } catch {
      this.audioError.set('No se pudo generar la voz.');
    }
  }

  protected openInBrowser(url: string): void {
    void this.api.openInBrowser(url);
  }

  private async load(word: string | null): Promise<void> {
    const id = ++this.requestId;
    this.audioError.set(null);
    if (!word?.trim()) {
      this.state.set({ status: 'idle' });
      return;
    }
    this.state.set({ status: 'loading', word });
    try {
      const lookup = await this.api.lookupLdoce(word);
      if (id !== this.requestId) return;
      this.state.set({ status: 'done', lookup });
      if (lookup.status === 'found') this.lookedUp.emit(lookup);
    } catch (error) {
      if (id === this.requestId) {
        this.state.set({
          status: 'error',
          word,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function groupEntries(entries: LdoceEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const group = groups.find(
      (g) =>
        g.headword === entry.headword && g.pronBrE === entry.pronBrE && g.pronAmE === entry.pronAmE,
    );
    const sense = { pos: entry.pos, definition: entry.definition };
    if (group) {
      group.senses.push(sense);
      group.audioBrE ??= entry.audioBrE;
      group.audioAmE ??= entry.audioAmE;
    } else {
      groups.push({
        headword: entry.headword,
        pronBrE: entry.pronBrE,
        ...(entry.pronFormsBrE ? { forms: entry.pronFormsBrE } : {}),
        pronAmE: entry.pronAmE,
        audioBrE: entry.audioBrE,
        audioAmE: entry.audioAmE,
        senses: [sense],
      });
    }
  }
  return groups;
}
