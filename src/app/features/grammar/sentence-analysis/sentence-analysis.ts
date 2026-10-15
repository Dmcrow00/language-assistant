import { Component, inject, signal } from '@angular/core';
import {
  CLAUSE_PATTERNS,
  ELEMENT_NAMES,
  ElementRole,
  GrammarAnalysis,
  GrammarToken,
} from '../../../../../shared/grammar';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { ClauseView } from '../shared/clause-view';
import { VerbPhraseView } from '../shared/verb-phrase-view';

const STRUCTURE_LABELS: Readonly<Record<string, string>> = {
  simple: 'Oración simple: una sola cláusula independiente.',
  compuesta: 'Oración compuesta: dos o más cláusulas independientes coordinadas.',
  compleja: 'Oración compleja: una cláusula independiente con al menos una subordinada.',
  'compuesta-compleja':
    'Oración compuesta-compleja: cláusulas coordinadas y al menos una subordinada.',
};

/**
 * Gramática → Análisis de oraciones (Quirk / Greenbaum): tipo de oración, cláusulas con sus
 * elementos SVOCA y su patrón, frases y su estructura, clases de palabras y grupos verbales.
 */
@Component({
  selector: 'app-sentence-analysis',
  imports: [ClauseView, VerbPhraseView],
  templateUrl: './sentence-analysis.html',
  styleUrl: './sentence-analysis.css',
})
export class SentenceAnalysis {
  protected readonly api = inject(FoneticaApiService);

  protected readonly text = signal('');
  protected readonly analysis = signal<GrammarAnalysis | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showWordClasses = signal(false);
  protected readonly patterns = CLAUSE_PATTERNS;
  protected readonly roles = (Object.keys(ELEMENT_NAMES) as ElementRole[]).map((role) => ({
    role,
    name: ELEMENT_NAMES[role],
    colorClass: role === 'Od' ? 'O' : role === 'Cs' || role === 'Co' ? 'C' : role,
  }));
  protected readonly examples = [
    'He sent his sister a postcard.',
    'They painted the walls white.',
    'The man who lives next door is a doctor.',
    'When it rains, we stay at home.',
    'She wants to learn French and he plays the piano.',
    'The letter was written by a famous poet.',
  ];

  private requestId = 0;

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
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.analyzeGrammar(text);
      if (id === this.requestId) this.analysis.set(result);
    } catch (error) {
      if (id === this.requestId)
        this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  protected structureLabel(structure: string): string {
    return STRUCTURE_LABELS[structure] ?? structure;
  }

  protected tokensOf(analysis: GrammarAnalysis, start: number, end: number): GrammarToken[] {
    return analysis.tokens.slice(start, end).filter((t) => t.pos !== 'PUNCT');
  }

  /** Color de la clase de palabra: el primer término ("sustantivo", "verbo"…). */
  protected wordClassKey(token: GrammarToken): string {
    return token.pos.toLowerCase();
  }
}
