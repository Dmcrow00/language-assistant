import { contextBridge, ipcRenderer } from 'electron';
import type { FoneticaApi, IpcChannel } from '../shared/fonetica-api';

/**
 * Puente entre la interfaz y el proceso main. Corre en sandbox: sólo puede importar 'electron',
 * por eso los canales van escritos acá (el tipo IpcChannel verifica que existan).
 */

const invoke = <T>(channel: IpcChannel, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: FoneticaApi = {
  searchSpelling: (query, limit) => invoke('lexicon:search-spelling', query, limit),
  searchPhonemes: (phonemes, options) => invoke('lexicon:search-phonemes', phonemes, options),
  lookupLdoce: (word) => invoke('ldoce:lookup', word),
  getAudio: (url) => invoke('ldoce:audio', url),
  openInBrowser: (url) => invoke('shell:open-in-browser', url),
  lexiconInfo: () => invoke('lexicon:info'),
  analyzeSentence: (text, options) => invoke('sentence:analyze', text, options),
  voiceAvailable: () => invoke('tts:available'),
  speakSentence: (text, options) => invoke('tts:sentence', text, options),
  speakPhonemes: (pron, options) => invoke('tts:phonemes', pron, options),
  pronsOf: (words) => invoke('lexicon:prons-of', words),
  checkTranscription: (written, expected) =>
    invoke('lexicon:check-transcription', written, expected),
  inflections: (verb) => invoke('lexicon:inflections', verb),
  grammarAvailable: () => invoke('grammar:available'),
  analyzeGrammar: (text) => invoke('grammar:analyze', text),
  setTheme: (theme) => invoke('window:set-theme', theme),
};

contextBridge.exposeInMainWorld('fonetica', api);
