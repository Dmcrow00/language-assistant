import { Component, computed, input } from '@angular/core';

/**
 * Muestra una transcripción entre barras con la tipografía fonética.
 * Los sonidos opcionales (entre paréntesis en los datos) van en cursiva, como en Longman.
 */
@Component({
  selector: 'app-ipa-text',
  // En una sola línea a propósito: los espacios entre etiquetas se verían entre los fonemas.
  template: `<span class="ipa" [class.ipa--large]="size() === 'large'" [class.ipa--wrap]="wrap()">
    @for (part of parts(); track $index) {
      @if (part.optional) {
        <i class="optional" title="Sonido opcional: algunos hablantes lo pronuncian y otros no">{{
          part.text
        }}</i>
      } @else {
        <span>{{ part.text }}</span>
      }
    }
  </span>`,
  styles: `
    .ipa {
      font-family: var(--font-ipa);
      white-space: nowrap;
    }
    .ipa--wrap {
      white-space: normal;
    }
    .ipa--large {
      font-size: 2rem;
    }
    .optional {
      color: var(--accent);
    }
  `,
})
export class IpaText {
  readonly pron = input.required<string>();
  readonly size = input<'normal' | 'large'>('normal');
  readonly slashes = input(true);
  /** Permite cortar en renglones (para oraciones largas). */
  readonly wrap = input(false);

  protected readonly parts = computed(() => {
    const parts = this.pron()
      .split(/(\([^)]*\))/)
      .filter((p) => p !== '')
      .map((p) =>
        p.startsWith('(') && p.endsWith(')')
          ? { text: p.slice(1, -1), optional: true }
          : { text: p, optional: false },
      );
    return this.slashes()
      ? [{ text: '/', optional: false }, ...parts, { text: '/', optional: false }]
      : parts;
  });
}
