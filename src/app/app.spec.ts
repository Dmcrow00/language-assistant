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
};

const texts = (el: HTMLElement, selector: string) =>
  [...el.querySelectorAll(selector)].map((t) => t.textContent?.trim());

describe('App', () => {
  beforeEach(async () => {
    window.fonetica = fakeApi;
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('tiene el menú Fonética / Gramática y arranca en Buscar palabra', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(texts(el, '.section')).toEqual(['Fonética', 'Gramática']);
    expect(texts(el, '.subnav .tab')).toEqual([
      'Buscar palabra',
      'Teclado fonético',
      'Oración',
      'Dictado',
      'Pares mínimos',
    ]);
    expect(el.querySelector('app-spelling-search')?.hasAttribute('hidden')).toBe(false);
    // Las pantallas que no se abrieron todavía no se crean.
    expect(el.querySelector('app-phonemic-keyboard')).toBeNull();
  });

  it('el teclado fonético tiene los 44 fonemas del RP más las vocales débiles', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    (el.querySelectorAll('.subnav .tab')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-ipa-keyboard .key:not(.key--mark)').length).toBe(46);
  });

  it('el menú Gramática muestra sus submenús y abre el análisis de oraciones', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    (el.querySelectorAll('.section')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(texts(el, '.subnav .tab')).toEqual([
      'Análisis de oraciones',
      'Grupo verbal',
      'Verbos irregulares',
      'Ejercicios',
    ]);
    expect(el.querySelector('app-sentence-analysis')?.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('app-spelling-search')?.hasAttribute('hidden')).toBe(true);
  });
});
