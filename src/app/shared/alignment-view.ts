import { Component, input } from '@angular/core';
import type { AlignmentStep } from '../../../shared/fonetica-api';

/**
 * Compara fonema por fonema lo que escribió el alumno con la palabra del diccionario:
 * verde = coincide, naranja = cambiado, rojo = faltó, tachado = sobra.
 */
@Component({
  selector: 'app-alignment-view',
  template: `
    <span class="alignment" aria-label="Comparación fonema por fonema">
      @for (step of steps(); track $index) {
        @switch (step.op) {
          @case ('match') {
            <span class="ph ph--match">{{ step.expected }}</span>
          }
          @case ('substituted') {
            <span
              class="ph ph--sub"
              [title]="
                'Escribiste /' + step.written + '/, la palabra tiene /' + step.expected + '/'
              "
              >{{ step.expected }}<sub>{{ step.written }}</sub></span
            >
          }
          @case ('missing') {
            <span class="ph ph--missing" [title]="'Faltó /' + step.expected + '/'">{{
              step.expected
            }}</span>
          }
          @case ('extra') {
            <span class="ph ph--extra" [title]="'Sobra /' + step.written + '/'">{{
              step.written
            }}</span>
          }
        }
      }
    </span>
  `,
  styles: `
    .alignment {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 2px;
      font-family: var(--font-ipa);
    }
    .ph {
      padding: 0 3px;
      border-radius: 4px;
      line-height: 1.5;
    }
    .ph--match {
      color: var(--ok);
    }
    .ph--sub {
      background: var(--warn-bg);
      color: var(--warn);
    }
    .ph--sub sub {
      font-size: 0.7em;
      margin-left: 1px;
      opacity: 0.85;
    }
    .ph--missing {
      background: var(--bad-bg);
      color: var(--bad);
      text-decoration: underline;
    }
    .ph--extra {
      color: var(--muted);
      text-decoration: line-through 2px var(--bad);
      border: 1px dashed var(--border);
    }
  `,
})
export class AlignmentView {
  readonly steps = input.required<AlignmentStep[]>();
}
