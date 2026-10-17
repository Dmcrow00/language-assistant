import { Component, input } from '@angular/core';
import type { PronSource } from '../../../shared/fonetica-api';
import { Icon } from './icon';

/**
 * De dónde sale una pronunciación, dicho para el alumno: «Confirmada» (Longman), «Estimada»
 * (diccionario incluido, todavía sin confirmar) o «Por regla» (armada a partir de otra palabra).
 */
@Component({
  selector: 'app-source-badge',
  imports: [Icon],
  template: `
    @switch (source()) {
      @case ('ldoce') {
        <span class="badge badge--ok" title="Coincide con la del diccionario Longman"
          ><app-icon name="check" size="0.95em" />Confirmada</span
        >
      }
      @case ('britfone') {
        <span
          class="badge badge--warn"
          title="Todavía no se confirmó con el diccionario: se confirma al abrir la palabra"
          >Estimada</span
        >
      }
      @case ('derived') {
        <span
          class="badge badge--info"
          title="Armada a partir de otra palabra (plural, pasado, -ing…)"
          >Por regla</span
        >
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class SourceBadge {
  readonly source = input<PronSource | 'derived' | 'rule' | null | undefined>(null);
}
