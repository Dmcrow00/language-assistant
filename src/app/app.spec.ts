import { TestBed } from '@angular/core/testing';
import type { FoneticaApi } from '../../shared/fonetica-api';
import { App } from './app';

/** Motor falso: la interfaz se prueba sin Electron. */
const fakeApi: FoneticaApi = {
  searchSpelling: async () => [
    { word: 'water', prons: ['ˈwɔːtə'], source: 'ldoce', kind: 'exact', score: 0 },
  ],
  searchPhonemes: async () => [],
  lookupLdoce: async (word) => ({
    query: word,
    status: 'not-found',
    entries: [],
    suggestions: [],
    fromCache: true,
  }),
  getAudio: async () => new Uint8Array(),
  openInBrowser: async () => undefined,
  lexiconInfo: async () => ({ total: 16000, fromLdoce: 3 }),
  analyzeSentence: async () => ({
    words: [],
    transcription: '',
    processes: [],
    connectedTranscription: '',
  }),
  voiceAvailable: async () => true,
  speakSentence: async () => new Uint8Array(),
  speakPhonemes: async () => new Uint8Array(),
  pronsOf: async () => ({}),
  checkTranscription: async () => ({ exact: true, distance: 0, alignment: [], expected: '' }),
  inflections: async (verb) => ({ base: verb, basePron: null, s: null, ed: null }),
  grammarAvailable: async () => true,
  analyzeGrammar: async () => ({ tokens: [], sentences: [] }),
  setTheme: async () => undefined,
};

const texts = (el: HTMLElement, selector: string) =>
  [...el.querySelectorAll(selector)].map((t) => t.textContent?.trim());

const navItem = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('.nav-item')].find(
    (b) => b.querySelector('.nav-label')?.textContent?.trim() === label,
  )!;

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    window.fonetica = fakeApi;
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('arranca en Inicio, con el menú de Fonética y Gramática', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(texts(el, '.nav-heading')).toEqual(['Fonética', 'Gramática']);
    expect(texts(el, '.nav .nav-item .nav-label')).toEqual([
      'Inicio',
      'Buscar palabra',
      'Teclado fonético',
      'Transcribir oración',
      'Dictado',
      'Pares mínimos',
      'Analizar oración',
      'Grupo verbal',
      'Verbos irregulares',
      'Ejercicios',
    ]);
    expect(el.querySelector('app-home')?.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('.breadcrumb')?.textContent?.trim()).toBe('Inicio');
    // Las pantallas que no se abrieron todavía no se crean.
    expect(el.querySelector('app-spelling-search')).toBeNull();
  });

  it('desde el inicio se abre una herramienta con su título y su paso a paso', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const card = [...el.querySelectorAll<HTMLButtonElement>('app-home .card')].find((c) =>
      c.textContent?.includes('Buscar una palabra'),
    )!;
    card.click();
    await fixture.whenStable();
    expect(el.querySelector('app-spelling-search')?.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('app-home')?.hasAttribute('hidden')).toBe(true);
    expect(el.querySelector('.intro h1')?.textContent?.trim()).toBe('Buscar una palabra');
    expect(el.querySelectorAll('.steps li').length).toBe(3);
    expect(el.querySelector('.breadcrumb')?.textContent).toContain('Fonética');
  });

  it('el teclado fonético tiene los 44 fonemas del RP más las vocales débiles', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    navItem(el, 'Teclado fonético').click();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-ipa-keyboard .key:not(.key--mark)').length).toBe(46);
  });

  it('Gramática abre el análisis de oraciones y deja montada la pantalla anterior', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    navItem(el, 'Buscar palabra').click();
    await fixture.whenStable();
    navItem(el, 'Analizar oración').click();
    await fixture.whenStable();
    expect(el.querySelector('app-sentence-analysis')?.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('app-spelling-search')?.hasAttribute('hidden')).toBe(true);
  });

  it('recuerda el tema elegido y el tamaño de letra', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('.segment[aria-label="Oscuro"]')!.click();
    el.querySelector<HTMLButtonElement>('.tool-button--big')!.click();
    await fixture.whenStable();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.125');
    const stored = JSON.parse(localStorage.getItem('fonetica-rp:preferencias')!);
    expect(stored.theme).toBe('dark');
    expect(stored.fontStep).toBe(2);
  });
});
