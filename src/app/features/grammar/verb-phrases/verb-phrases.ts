import { Component, inject, signal } from '@angular/core';
import type { VerbPhraseAnalysis } from '../../../../../shared/grammar';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { VerbPhraseView } from '../shared/verb-phrase-view';

/**
 * Gramática → Grupo verbal: todos los grupos verbales de lo que se escriba, con tiempo,
 * aspecto (perfect, progressive), voz, modalidad y finitud (Quirk: auxiliares de tipo
 * A modal, B perfect, C progressive y D passive, siempre en ese orden).
 */
@Component({
  selector: 'app-verb-phrases',
  imports: [VerbPhraseView],
  templateUrl: './verb-phrases.html',
  styleUrl: './verb-phrases.css',
})
export class VerbPhrases {
  protected readonly api = inject(FoneticaApiService);

  protected readonly text = signal('');
  protected readonly phrases = signal<Array<{ sentence: string; phrase: VerbPhraseAnalysis }>>([]);
  protected readonly analyzed = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Una oración por cada combinación interesante; un clic la analiza. */
  protected readonly examples = [
    'She works in a bank.',
    'They were watching TV when I arrived.',
    'I have lived here since 2010.',
    'He has been working all day.',
    'The bridge was built in 1890.',
    'The house is being painted.',
    'The report will have been finished by Friday.',
    'You should have told me.',
    'Having finished the exam, she left early.',
    "Don't touch that!",
  ];

  /** Las combinaciones de auxiliares de Quirk: siempre en el orden modal → perfect → progressive → passive. */
  protected readonly combinations = [
    { name: 'modal (A)', form: 'modal + infinitivo', example: 'can write' },
    { name: 'perfect (B)', form: 'have + participio (-ed)', example: 'has written' },
    { name: 'progressive (C)', form: 'be + participio (-ing)', example: 'is writing' },
    { name: 'passive (D)', form: 'be + participio (-ed)', example: 'is written' },
    { name: 'A + B', form: 'modal + have + -ed', example: 'might have written' },
    { name: 'B + C', form: 'have + been + -ing', example: 'has been writing' },
    { name: 'C + D', form: 'be + being + -ed', example: 'is being written' },
    {
      name: 'A + B + C + D',
      form: 'modal + have + been + being + -ed',
      example: 'might have been being written',
    },
  ];

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.analyze();
    }
  }

  protected useExample(sentence: string): void {
    this.text.set(sentence);
    void this.analyze();
  }

  protected async analyze(): Promise<void> {
    const text = this.text().trim();
    if (!text) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const analysis = await this.api.analyzeGrammar(text);
      this.phrases.set(
        analysis.sentences.flatMap((s) =>
          s.verbPhrases.map((phrase) => ({ sentence: s.text, phrase })),
        ),
      );
      this.analyzed.set(true);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.loading.set(false);
    }
  }
}
