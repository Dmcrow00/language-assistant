import { Component, computed, input } from '@angular/core';

/** Aciertos de la sesión con una barra de progreso («3 de 5»). */
@Component({
  selector: 'app-session-score',
  template: `
    <div class="score">
      <span class="label">
        Aciertos: <strong>{{ right() }} de {{ total() }}</strong>
      </span>
      <span
        class="bar"
        role="img"
        [attr.aria-label]="right() + ' aciertos de ' + total() + ' intentos'"
      >
        <span class="fill" [style.width.%]="percent()"></span>
      </span>
    </div>
  `,
  styles: `
    .score {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 9rem;
    }
    .label {
      color: var(--text-soft);
      font-size: 0.9rem;
    }
    .label strong {
      color: var(--text);
    }
    .bar {
      display: block;
      height: 8px;
      border-radius: 999px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--ok);
      transition: width 0.2s;
    }
  `,
})
export class SessionScore {
  readonly right = input(0);
  readonly total = input(0);

  protected readonly percent = computed(() =>
    this.total() ? Math.round((this.right() / this.total()) * 100) : 0,
  );
}
