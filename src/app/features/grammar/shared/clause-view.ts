import { Component, computed, input, signal } from '@angular/core';
import {
  CLAUSE_PATTERNS,
  ClauseAnalysis,
  ClauseElement,
  ELEMENT_NAMES,
} from '../../../../../shared/grammar';
import { VerbPhraseView } from './verb-phrase-view';

/**
 * Una cláusula analizada: sus elementos (S V O C A) en una fila, cada uno con su forma
 * (NP, PP, cláusula…). Al hacer clic en un elemento se ve su estructura interna y, si es una
 * cláusula o contiene una (relativa, no finita…), su análisis completo, recursivamente.
 */
@Component({
  selector: 'app-clause-view',
  imports: [VerbPhraseView],
  templateUrl: './clause-view.html',
  styleUrl: './clause-view.css',
})
export class ClauseView {
  readonly clause = input.required<ClauseAnalysis>();
  readonly depth = input(0);

  protected readonly selected = signal<number | null>(null);
  protected readonly selectedElement = computed<ClauseElement | null>(() => {
    const index = this.selected();
    return index === null ? null : (this.clause().elements[index] ?? null);
  });
  protected readonly patternInfo = computed(() =>
    CLAUSE_PATTERNS.find((p) => p.pattern === this.clause().pattern),
  );

  protected toggle(index: number): void {
    this.selected.update((current) => (current === index ? null : index));
  }

  protected roleName(element: ClauseElement): string {
    const name = ELEMENT_NAMES[element.role];
    if (element.role !== 'A') return name;
    return element.obligatory ? `${name} obligatorio` : `${name} (opcional)`;
  }

  /** Clase de color: los objetos y los complementos comparten color por tipo. */
  protected roleClass(element: ClauseElement): string {
    return element.role === 'Od'
      ? 'O'
      : element.role === 'Cs' || element.role === 'Co'
        ? 'C'
        : element.role;
  }
}
