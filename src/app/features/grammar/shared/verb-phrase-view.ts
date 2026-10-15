import { Component, input } from '@angular/core';
import type { VerbPartRole, VerbPhraseAnalysis } from '../../../../../shared/grammar';

/** Colores y abreviaturas de cada parte del grupo verbal (Quirk: modal, perfect, progressive, passive). */
const PART_STYLE: Readonly<Record<VerbPartRole, string>> = {
  modal: 'modal',
  'auxiliar de perfecto': 'perfect',
  'auxiliar de progresivo': 'progressive',
  'auxiliar de pasiva': 'passive',
  'auxiliar do': 'do',
  'marca de infinitivo': 'to',
  negación: 'neg',
  'verbo léxico': 'lexical',
  partícula: 'particle',
};

/** Un grupo verbal con cada palabra coloreada según su función y el nombre de la forma. */
@Component({
  selector: 'app-verb-phrase-view',
  template: `
    <div class="vp">
      <div class="parts">
        @for (part of phrase().parts; track $index) {
          <span class="part part--{{ style(part.role) }}" [title]="part.role">
            <span class="word">{{ part.text }}</span>
            <span class="role">{{ part.role }}</span>
          </span>
        }
      </div>
      <div class="label">
        <strong>{{ phrase().label }}</strong>
        <span class="description">{{ phrase().description }}</span>
      </div>
    </div>
  `,
  styles: `
    .vp {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 18px;
    }
    .parts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .part {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 8px;
      border-radius: 8px;
      border-bottom: 3px solid var(--vp-color, var(--muted));
      background: var(--surface-2);
    }
    .word {
      font-weight: 700;
    }
    .role {
      color: var(--muted);
      font-size: 0.68rem;
      white-space: nowrap;
    }
    .part--modal {
      --vp-color: var(--role-C);
    }
    .part--perfect {
      --vp-color: var(--role-O);
    }
    .part--progressive {
      --vp-color: var(--role-A);
    }
    .part--passive {
      --vp-color: var(--role-S);
    }
    .part--lexical {
      --vp-color: var(--role-V);
    }
    .part--do,
    .part--to,
    .part--neg,
    .part--particle {
      --vp-color: var(--muted);
    }
    .label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .description {
      color: var(--text-soft);
      font-size: 0.88rem;
    }
  `,
})
export class VerbPhraseView {
  readonly phrase = input.required<VerbPhraseAnalysis>();

  protected style(role: VerbPartRole): string {
    return PART_STYLE[role];
  }
}
