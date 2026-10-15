import { Component, computed, input } from '@angular/core';
import { GLOSSARY, GlossaryKey } from './glossary';

let nextId = 0;

/**
 * Un término de la materia con su «?»: al tocarlo se abre la explicación del glosario al lado
 * (popover nativo: se cierra con Esc o tocando afuera). Sin contenido muestra sólo el «?».
 *
 *   <app-term key="forma-debil">forma débil</app-term>
 */
@Component({
  selector: 'app-term',
  template: `<span class="term"
      ><span class="label"><ng-content /></span
      ><button
        type="button"
        class="q"
        [attr.popovertarget]="id"
        [attr.style]="'anchor-name: --' + id"
        [attr.aria-label]="'Qué significa: ' + entry().term"
        [title]="'Qué significa: ' + entry().term"
      >
        ?
      </button></span
    ><span [id]="id" popover class="pop" [attr.style]="'position-anchor: --' + id"
      ><strong>{{ entry().term }}</strong
      ><span>{{ entry().definition }}</span></span
    >`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }
    .term {
      display: inline-flex;
      align-items: baseline;
      gap: 0.3em;
    }
    .label:not(:empty) {
      border-bottom: 2px dotted currentColor;
    }
    .q {
      display: inline-grid;
      place-items: center;
      align-self: center;
      width: 1.15rem;
      height: 1.15rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: var(--accent);
      color: var(--on-accent);
      font: inherit;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
    }
    .q:hover {
      background: var(--accent-hover);
    }
    .pop {
      inset: auto;
      position-area: bottom span-right;
      position-try-fallbacks: flip-block, flip-inline;
      margin: 6px 0;
      width: max-content;
      max-width: min(24rem, 90vw);
      padding: 0.75rem 0.9rem;
      border: 0;
      border-radius: 12px;
      background: var(--accent);
      color: var(--on-accent);
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.22);
      font-size: 0.92rem;
      font-weight: 400;
      line-height: 1.5;
      text-align: left;
      white-space: normal;
      letter-spacing: normal;
      text-transform: none;
    }
    .pop strong {
      display: block;
      margin-bottom: 2px;
    }
  `,
})
export class Term {
  readonly key = input.required<GlossaryKey>();

  protected readonly id = `termino-${++nextId}`;
  protected readonly entry = computed(() => GLOSSARY[this.key()]);
}
