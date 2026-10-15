import { Injectable, signal } from '@angular/core';
import type { GrammarAnalysis } from '../../../shared/grammar';
import type {
  FoneticaApi,
  InflectionInfo,
  LdoceLookup,
  LexiconInfo,
  PhonemeMatch,
  PhonemeSearchOptions,
  SentenceAnalysis,
  SentenceOptions,
  SpeechOptions,
  SpellingHit,
  TranscriptionCheck,
} from '../../../shared/fonetica-api';

/**
 * Acceso al motor que corre en el proceso main de Electron (window.fonetica).
 * Además lleva la cuenta de cuántas palabras tiene el diccionario local, que crece
 * con cada consulta a Longman.
 */
@Injectable({ providedIn: 'root' })
export class FoneticaApiService {
  private readonly api: FoneticaApi | undefined = window.fonetica;

  /** false si la interfaz se abrió fuera de Electron (por ejemplo con `ng serve` en un navegador). */
  readonly available = !!this.api;
  readonly lexiconInfo = signal<LexiconInfo | null>(null);
  /** Si la voz británica (Piper) está instalada. */
  readonly voiceAvailable = signal(false);
  /** Si el analizador gramatical (spaCy) está instalado. */
  readonly grammarAvailable = signal(false);

  constructor() {
    void this.refreshLexiconInfo();
    void this.api?.voiceAvailable().then((available) => this.voiceAvailable.set(available));
    void this.api?.grammarAvailable().then((available) => this.grammarAvailable.set(available));
  }

  searchSpelling(query: string, limit?: number): Promise<SpellingHit[]> {
    return this.require().searchSpelling(query, limit);
  }

  searchPhonemes(phonemes: string[], options: PhonemeSearchOptions): Promise<PhonemeMatch[]> {
    return this.require().searchPhonemes(phonemes, options);
  }

  async lookupLdoce(word: string): Promise<LdoceLookup> {
    const lookup = await this.require().lookupLdoce(word);
    if (lookup.status === 'found' && !lookup.fromCache) void this.refreshLexiconInfo();
    return lookup;
  }

  getAudio(url: string): Promise<Uint8Array> {
    return this.require().getAudio(url);
  }

  openInBrowser(url: string): Promise<void> {
    return this.require().openInBrowser(url);
  }

  analyzeSentence(text: string, options: SentenceOptions): Promise<SentenceAnalysis> {
    return this.require().analyzeSentence(text, options);
  }

  speakSentence(text: string, options: SentenceOptions & SpeechOptions): Promise<Uint8Array> {
    return this.require().speakSentence(text, options);
  }

  speakPhonemes(pron: string, options: SpeechOptions): Promise<Uint8Array> {
    return this.require().speakPhonemes(pron, options);
  }

  pronsOf(words: string[]): ReturnType<FoneticaApi['pronsOf']> {
    return this.require().pronsOf(words);
  }

  checkTranscription(written: string[], expected: string): Promise<TranscriptionCheck> {
    return this.require().checkTranscription(written, expected);
  }

  inflections(verb: string): Promise<InflectionInfo> {
    return this.require().inflections(verb);
  }

  analyzeGrammar(text: string): Promise<GrammarAnalysis> {
    return this.require().analyzeGrammar(text);
  }

  private async refreshLexiconInfo(): Promise<void> {
    if (this.api) this.lexiconInfo.set(await this.api.lexiconInfo());
  }

  private require(): FoneticaApi {
    if (!this.api) throw new Error('La aplicación tiene que abrirse desde Electron (npm start).');
    return this.api;
  }
}
