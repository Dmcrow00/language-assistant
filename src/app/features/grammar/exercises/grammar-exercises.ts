import { Component, computed, signal } from '@angular/core';
import { CLAUSE_PATTERNS, ELEMENT_NAMES, ElementRole } from '../../../../../shared/grammar';
import {
  GRAMMAR_EXERCISES,
  GrammarExercise,
  SUBJECT_KINDS,
  SubjectKind,
} from '../../../../../shared/study-data/grammar-exercises';
import { Icon } from '../../../shared/icon';
import { SessionScore } from '../../../shared/session-score';
import { Term } from '../../../shared/term';

const ROLES: readonly ElementRole[] = ['S', 'V', 'Od', 'Oi', 'Cs', 'Co', 'A'];

/**
 * answering: respondiendo · hint: el primer intento tuvo errores y se marca qué revisar, sin dar
 * la respuesta · done: acertó o se mostró la respuesta con la explicación.
 */
type Phase = 'answering' | 'hint' | 'done';

/** Qué quedó mal en el último intento (se desmarca a medida que el alumno lo cambia). */
interface Marks {
  constituents: ReadonlySet<number>;
  subject: boolean;
  pattern: boolean;
}

const NO_MARKS: Marks = { constituents: new Set(), subject: false, pattern: false };

/**
 * Gramática → Ejercicios: el alumno asigna a cada constituyente su función, dice cómo es el
 * sujeto (expreso, implícito o elíptico) y elige el tipo de cláusula de Quirk. Si algo no está
 * bien se marca qué revisar y tiene un segundo intento antes de ver la respuesta. Las respuestas
 * están escritas a mano (shared/study-data/grammar-exercises.ts).
 */
@Component({
  selector: 'app-grammar-exercises',
  imports: [Icon, SessionScore, Term],
  templateUrl: './grammar-exercises.html',
  styleUrl: './grammar-exercises.css',
})
export class GrammarExercises {
  protected readonly roles = ROLES;
  protected readonly roleNames = ELEMENT_NAMES;
  protected readonly patterns = CLAUSE_PATTERNS;
  protected readonly subjectKinds = SUBJECT_KINDS;
  protected readonly total = GRAMMAR_EXERCISES.length;

  /** Orden aleatorio, para no hacer siempre los mismos primero. */
  private readonly order = signal(shuffle(GRAMMAR_EXERCISES.map((_, i) => i)));
  protected readonly position = signal(0);
  protected readonly answers = signal<Array<ElementRole | null>>([]);
  protected readonly subjectAnswer = signal<SubjectKind | null>(null);
  protected readonly patternAnswer = signal<string | null>(null);
  protected readonly phase = signal<Phase>('answering');
  protected readonly attempts = signal(0);
  protected readonly marks = signal<Marks>(NO_MARKS);
  /** Acertó (al primer intento o después de la pista) sin ver la respuesta. */
  protected readonly solved = signal(false);
  protected readonly score = signal({ right: 0, total: 0 });

  protected readonly exercise = computed<GrammarExercise>(
    () => GRAMMAR_EXERCISES[this.order()[this.position()]],
  );
  protected readonly subject = computed<SubjectKind>(() => this.exercise().subject ?? 'expreso');
  protected readonly done = computed(() => this.phase() === 'done');
  protected readonly complete = computed(
    () =>
      this.answers().length === this.exercise().constituents.length &&
      this.answers().every((a) => a) &&
      !!this.subjectAnswer() &&
      !!this.patternAnswer(),
  );
  protected readonly allRight = computed(
    () =>
      this.exercise().constituents.every((c, i) => this.answers()[i] === c.role) &&
      this.subjectAnswer() === this.subject() &&
      this.patternAnswer() === this.exercise().pattern,
  );
  protected readonly markCount = computed(() => {
    const m = this.marks();
    return m.constituents.size + (m.subject ? 1 : 0) + (m.pattern ? 1 : 0);
  });

  constructor() {
    this.reset();
  }

  protected setRole(index: number, role: ElementRole): void {
    if (this.done()) return;
    this.answers.update((list) => list.map((value, i) => (i === index ? role : value)));
    this.marks.update((m) => {
      const constituents = new Set(m.constituents);
      constituents.delete(index);
      return { ...m, constituents };
    });
  }

  protected setSubject(kind: SubjectKind): void {
    if (this.done()) return;
    this.subjectAnswer.set(kind);
    this.marks.update((m) => ({ ...m, subject: false }));
  }

  protected setPattern(pattern: string): void {
    if (this.done()) return;
    this.patternAnswer.set(pattern);
    this.marks.update((m) => ({ ...m, pattern: false }));
  }

  protected check(): void {
    if (!this.complete() || this.done()) return;
    this.attempts.update((n) => n + 1);
    if (this.allRight()) {
      this.solved.set(true);
      this.finish();
    } else if (this.attempts() === 1) {
      const exercise = this.exercise();
      this.marks.set({
        constituents: new Set(
          exercise.constituents.flatMap((c, i) => (this.answers()[i] === c.role ? [] : [i])),
        ),
        subject: this.subjectAnswer() !== this.subject(),
        pattern: this.patternAnswer() !== exercise.pattern,
      });
      this.phase.set('hint');
    } else {
      this.finish();
    }
  }

  /** Muestra la respuesta sin otro intento. */
  protected reveal(): void {
    if (!this.done()) this.finish();
  }

  protected next(): void {
    if (this.position() + 1 >= this.order().length) {
      this.order.set(shuffle(GRAMMAR_EXERCISES.map((_, i) => i)));
      this.position.set(0);
    } else {
      this.position.update((p) => p + 1);
    }
    this.reset();
  }

  /** Clase de color del rol (los objetos y los complementos comparten color). */
  protected colorOf(role: ElementRole): string {
    return role === 'Od' ? 'O' : role === 'Cs' || role === 'Co' ? 'C' : role;
  }

  protected subjectLabel(kind: SubjectKind): string {
    return SUBJECT_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  }

  private finish(): void {
    this.phase.set('done');
    this.marks.set(NO_MARKS);
    this.score.update((s) => ({
      right: s.right + (this.solved() ? 1 : 0),
      total: s.total + 1,
    }));
  }

  private reset(): void {
    this.answers.set(this.exercise().constituents.map(() => null));
    this.subjectAnswer.set(null);
    this.patternAnswer.set(null);
    this.phase.set('answering');
    this.attempts.set(0);
    this.marks.set(NO_MARKS);
    this.solved.set(false);
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
