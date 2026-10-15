import { Component, computed, inject, OnInit, signal } from '@angular/core';
import type { InflectionInfo } from '../../../../../shared/fonetica-api';
import {
  IRREGULAR_VERBS,
  IrregularVerb,
  VerbPattern,
  verbPattern,
} from '../../../../../shared/study-data/irregular-verbs';
import { AudioPlayerService } from '../../../core/audio-player.service';
import { FoneticaApiService } from '../../../core/fonetica-api.service';
import { IpaText } from '../../../shared/ipa-text';

type FormKey = 'base' | 'past' | 'participle';

interface VerbRow {
  verb: IrregularVerb;
  pattern: VerbPattern;
  /** Cada forma con sus variantes ("learnt / learned") y la transcripción de cada una. */
  forms: Record<FormKey, Array<{ spelling: string; pron: string | null }>>;
}

const PATTERN_LABELS: Readonly<Record<VerbPattern, string>> = {
  AAA: 'las tres iguales (cut)',
  ABB: 'pasado = participio (keep)',
  ABA: 'base = participio (come)',
  ABC: 'las tres distintas (go)',
};

/**
 * Gramática → Verbos irregulares: tabla con las tres formas, su transcripción y audio, filtros
 * por patrón, práctica, y la pronunciación de las terminaciones -s / -ed de los regulares.
 */
@Component({
  selector: 'app-irregular-verbs',
  imports: [IpaText],
  templateUrl: './irregular-verbs.html',
  styleUrl: './irregular-verbs.css',
})
export class IrregularVerbs implements OnInit {
  protected readonly api = inject(FoneticaApiService);
  private readonly audio = inject(AudioPlayerService);

  protected readonly rows = signal<VerbRow[]>([]);
  protected readonly filter = signal('');
  protected readonly pattern = signal<VerbPattern | null>(null);
  protected readonly patternLabels = PATTERN_LABELS;
  protected readonly patterns = Object.keys(PATTERN_LABELS) as VerbPattern[];

  protected readonly visible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return this.rows().filter(
      (r) =>
        (!this.pattern() || r.pattern === this.pattern()) &&
        (!q ||
          [r.verb.base, r.verb.past, r.verb.participle, r.verb.meaning].some((f) =>
            f.toLowerCase().includes(q),
          )),
    );
  });

  // Práctica: se muestra la base y el alumno escribe pasado y participio.
  protected readonly practice = signal<{
    row: VerbRow;
    past: string;
    participle: string;
    checked: boolean;
  } | null>(null);
  protected readonly score = signal({ right: 0, total: 0 });

  // Terminaciones -s / -ed.
  protected readonly regular = signal('');
  protected readonly inflection = signal<InflectionInfo | null>(null);
  protected readonly regularExamples = [
    'watch',
    'play',
    'stop',
    'want',
    'need',
    'kiss',
    'love',
    'laugh',
    'decide',
    'fix',
  ];

  async ngOnInit(): Promise<void> {
    const words = IRREGULAR_VERBS.flatMap((v) =>
      [v.base, v.past, v.participle].flatMap((f) => f.split(' / ')),
    );
    const prons = await this.api
      .pronsOf([...new Set(words)])
      .catch(() => ({}) as Record<string, null>);
    const pronOf = (word: string, fixed?: string) =>
      fixed ?? prons[word]?.prons[0]?.split(',')[0].trim() ?? null;
    this.rows.set(
      IRREGULAR_VERBS.map((verb) => ({
        verb,
        pattern: verbPattern(verb),
        forms: {
          base: verb.base
            .split(' / ')
            .map((s) => ({ spelling: s, pron: pronOf(s, verb.prons?.base) })),
          past: verb.past
            .split(' / ')
            .map((s) => ({ spelling: s, pron: pronOf(s, verb.prons?.past) })),
          participle: verb.participle
            .split(' / ')
            .map((s) => ({ spelling: s, pron: pronOf(s, verb.prons?.participle) })),
        },
      })),
    );
  }

  protected togglePattern(pattern: VerbPattern): void {
    this.pattern.update((current) => (current === pattern ? null : pattern));
  }

  /** La voz británica pronuncia la transcripción (sin conexión, y exacta para "read" /red/). */
  protected async speak(pron: string | null): Promise<void> {
    if (!pron || !this.api.voiceAvailable()) return;
    const wav = await this.api.speakPhonemes(pron, { slow: this.audio.slow() });
    await this.audio.playVoice(wav, `verb:${pron}`);
  }

  protected nextPractice(): void {
    const pool = this.visible().length ? this.visible() : this.rows();
    const row = pool[Math.floor(Math.random() * pool.length)];
    this.practice.set({ row, past: '', participle: '', checked: false });
  }

  protected setAnswer(field: 'past' | 'participle', value: string): void {
    this.practice.update((p) => p && { ...p, [field]: value });
  }

  protected checkPractice(): void {
    const p = this.practice();
    if (!p || p.checked) return;
    const right =
      this.isRight(p.row.verb.past, p.past) && this.isRight(p.row.verb.participle, p.participle);
    this.score.update((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    this.practice.set({ ...p, checked: true });
  }

  protected isRight(expected: string, answer: string): boolean {
    const options = expected.split(' / ').map((f) => f.toLowerCase());
    return options.includes(answer.trim().toLowerCase());
  }

  protected async inflect(verb = this.regular()): Promise<void> {
    const word = verb.trim();
    this.regular.set(word);
    if (!word) return;
    this.inflection.set(await this.api.inflections(word));
  }

  protected onPracticeKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    if (this.practice()?.checked) this.nextPractice();
    else this.checkPractice();
  }
}
