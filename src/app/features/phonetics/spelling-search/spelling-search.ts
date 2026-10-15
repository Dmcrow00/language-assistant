import { Component, computed, inject, signal } from '@angular/core';
import type { SpellingHit } from '../../../../../shared/fonetica-api';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { Icon } from '../../../shared/icon';
import { IpaText } from '../../../shared/ipa-text';
import { SourceBadge } from '../../../shared/source-badge';
import { WordDetail } from '../../../shared/word-detail/word-detail';

/**
 * Fonética → Buscar palabra: el alumno escribe la palabra con su ortografía normal. Mientras
 * escribe ve palabras parecidas del diccionario local (sirve aunque la haya escrito mal) y al
 * elegir una se consulta Longman para confirmar la transcripción y escucharla.
 */
@Component({
  selector: 'app-spelling-search',
  imports: [Icon, IpaText, SourceBadge, WordDetail],
  templateUrl: './spelling-search.html',
  styleUrl: './spelling-search.css',
})
export class SpellingSearch {
  private readonly api = inject(FoneticaApiService);

  protected readonly query = signal('');
  protected readonly hits = signal<SpellingHit[]>([]);
  protected readonly activeIndex = signal(0);
  protected readonly selected = signal<string | null>(null);
  protected readonly selectedFallback = computed(() => {
    const word = this.selected()?.toLowerCase();
    return this.hits().find((h) => h.word.toLowerCase() === word)?.prons[0] ?? null;
  });
  protected readonly hasExactMatch = computed(() => this.hits()[0]?.kind === 'exact');
  protected readonly hasEstimated = computed(() =>
    this.hits().some((h) => h.source === 'britfone'),
  );
  /** Palabras cuya ortografía no anticipa la pronunciación. */
  protected readonly examples = ['thought', 'schedule', 'colonel', 'island', 'recipe'];

  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private searchId = 0;

  protected onInput(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.search(), 120);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.hits().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.activeIndex.update((i) => Math.min(i + 1, count - 1));
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.activeIndex.update((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Enter sobre una sugerencia la elige; si no hay, se busca en Longman lo que se escribió tal cual.
      const hit = this.hits()[this.activeIndex()];
      this.select(
        hit && (this.activeIndex() > 0 || hit.kind === 'exact') ? hit.word : this.query().trim(),
      );
    } else if (event.key === 'Escape') {
      this.onInput('');
    }
  }

  protected select(word: string): void {
    if (word) this.selected.set(word);
  }

  /** Un ejemplo de «Probá con»: se busca y se abre. */
  protected useExample(word: string): void {
    this.requestWord(word);
  }

  /** Sugerencia de Longman ("¿Quisiste decir…?"): pasa al buscador y se consulta. */
  protected requestWord(word: string): void {
    this.query.set(word);
    this.select(word);
    void this.search();
  }

  /** Vuelve a buscar sin mover la selección (después de consultar Longman cambia la fuente). */
  protected refresh(): void {
    void this.search(true);
  }

  private async search(keepActive = false): Promise<void> {
    const id = ++this.searchId;
    const query = this.query().trim();
    const hits = query ? await this.api.searchSpelling(query, 25) : [];
    if (id !== this.searchId) return;
    this.hits.set(hits);
    if (!keepActive) this.activeIndex.set(0);
  }
}
