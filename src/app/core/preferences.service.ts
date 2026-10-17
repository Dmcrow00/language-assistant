import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { FoneticaApiService } from './fonetica-api.service';

export type ThemeChoice = 'auto' | 'light' | 'dark';

/** Tamaños de letra de A− / A+ (100 % = 16 px). */
const FONT_SCALES = [0.875, 1, 1.125, 1.25, 1.375] as const;
const DEFAULT_FONT_STEP = 1;
/** La misma clave lee public/theme-init.js para aplicar el tema antes de dibujar. */
const STORAGE_KEY = 'fonetica-rp:preferencias';

type GuideState = 'open' | 'closed';

interface StoredPreferences {
  theme: ThemeChoice;
  fontStep: number;
  slowAudio: boolean;
  lastView: string | null;
  /** Paso a paso que el alumno abrió o cerró a mano, por pantalla. */
  guides: Record<string, GuideState>;
  /** Herramientas que ya se usaron alguna vez. */
  seenTools: string[];
  welcomeDone: boolean;
}

const DEFAULTS: StoredPreferences = {
  theme: 'auto',
  fontStep: DEFAULT_FONT_STEP,
  slowAudio: false,
  lastView: null,
  guides: {},
  seenTools: [],
  welcomeDone: false,
};

/**
 * Preferencias del alumno que sobreviven al cerrar la app: tema, tamaño de letra, audio lento,
 * última pantalla usada, el estado de cada «Paso a paso» y si ya vio la bienvenida.
 *
 * El «Paso a paso» de una herramienta se muestra abierto mientras es nueva para el alumno; en
 * las sesiones siguientes arranca plegado, salvo que él lo haya dejado abierto.
 * Se guardan en el almacenamiento local de la ventana; si no está disponible, se usan las de
 * fábrica y la app funciona igual.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly api = inject(FoneticaApiService);
  private readonly stored = readStored();

  readonly theme = signal<ThemeChoice>(this.stored.theme);
  readonly fontStep = signal(this.stored.fontStep);
  readonly slowAudio = signal(this.stored.slowAudio);
  readonly lastView = signal<string | null>(this.stored.lastView);
  readonly guides = signal<Readonly<Record<string, GuideState>>>(this.stored.guides);
  readonly seenTools = signal<ReadonlySet<string>>(new Set(this.stored.seenTools));
  readonly welcomeDone = signal(this.stored.welcomeDone);
  /** Herramientas usadas en sesiones anteriores (no cambia durante la sesión). */
  private readonly seenBefore: ReadonlySet<string> = new Set(this.stored.seenTools);

  readonly fontPercent = computed(() => Math.round(FONT_SCALES[this.fontStep()] * 100));
  readonly canShrink = computed(() => this.fontStep() > 0);
  readonly canGrow = computed(() => this.fontStep() < FONT_SCALES.length - 1);

  constructor() {
    effect(() => {
      const root = document.documentElement;
      const theme = this.theme();
      if (theme === 'auto') delete root.dataset['theme'];
      else root.dataset['theme'] = theme;
      void this.api.setTheme(theme === 'auto' ? 'system' : theme).catch(() => undefined);
    });
    effect(() => {
      document.documentElement.style.setProperty(
        '--font-scale',
        String(FONT_SCALES[this.fontStep()]),
      );
    });
    effect(() =>
      writeStored({
        theme: this.theme(),
        fontStep: this.fontStep(),
        slowAudio: this.slowAudio(),
        lastView: this.lastView(),
        guides: this.guides(),
        seenTools: [...this.seenTools()],
        welcomeDone: this.welcomeDone(),
      }),
    );
  }

  shrinkFont(): void {
    if (this.canShrink()) this.fontStep.update((step) => step - 1);
  }

  growFont(): void {
    if (this.canGrow()) this.fontStep.update((step) => step + 1);
  }

  isGuideOpen(view: string): boolean {
    const state = this.guides()[view];
    return state ? state === 'open' : !this.seenBefore.has(view);
  }

  toggleGuide(view: string): void {
    const next: GuideState = this.isGuideOpen(view) ? 'closed' : 'open';
    this.guides.update((guides) => ({ ...guides, [view]: next }));
  }

  markSeen(view: string): void {
    if (!this.seenTools().has(view)) this.seenTools.update((seen) => new Set([...seen, view]));
  }
}

function readStored(): StoredPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StoredPreferences>;
    return {
      theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : DEFAULTS.theme,
      fontStep:
        Number.isInteger(raw.fontStep) && raw.fontStep! >= 0 && raw.fontStep! < FONT_SCALES.length
          ? raw.fontStep!
          : DEFAULTS.fontStep,
      slowAudio: raw.slowAudio === true,
      lastView: typeof raw.lastView === 'string' ? raw.lastView : null,
      guides: Object.fromEntries(
        Object.entries(raw.guides ?? {}).filter(([, v]) => v === 'open' || v === 'closed'),
      ) as Record<string, GuideState>,
      seenTools: Array.isArray(raw.seenTools)
        ? raw.seenTools.filter((v) => typeof v === 'string')
        : [],
      welcomeDone: raw.welcomeDone === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeStored(preferences: StoredPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Sin almacenamiento las preferencias duran hasta cerrar la app.
  }
}
