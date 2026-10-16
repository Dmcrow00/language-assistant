/**
 * Genera los datos "dorados" de paridad para el sidecar Java (Fase 5, ADR-0002): corre el motor
 * TypeScript sobre un corpus fijo y guarda las respuestas completas en
 * sidecar-java/src/test/resources/paridad/. Los tests de JUnit (ParidadTest) comparan la salida
 * del motor Java contra estos archivos, campo por campo.
 *
 *   npm run build:electron && node dist-electron/electron/test/paridad/generar-paridad.js
 *
 * Se usó una sola vez, con el motor TypeScript todavía en el repo; se borra junto con él.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SentenceOptions } from '../../../shared/fonetica-api';
import { PHONEMES } from '../../../shared/phoneme-inventory';
import { exerciseSentence, GRAMMAR_EXERCISES } from '../../../shared/study-data/grammar-exercises';
import { IRREGULAR_VERBS } from '../../../shared/study-data/irregular-verbs';
import { DICTATION_LEVELS, MINIMAL_PAIRS } from '../../../shared/study-data/phonetics-practice';
import { tokenize } from '../../core/ipa';
import { Lexicon, normalizeKey } from '../../core/lexicon';
import { analyzeSentence } from '../../core/sentence';
import { checkTranscription, inflections } from '../../core/study-tools';
import { ParsedToken } from '../../grammar/nlp-client';
import { analyzeGrammar } from '../../grammar/quirk-analysis';
import { sentenceToEspeak, wordToEspeak } from '../../tts/espeak-notation';

const ROOT = join(__dirname, '..', '..', '..', '..');
const OUT = join(ROOT, 'sidecar-java', 'src', 'test', 'resources', 'paridad');
mkdirSync(OUT, { recursive: true });
/** Un caso por línea: el diff de un cambio muestra sólo los casos que cambiaron. */
const save = (name: string, data: unknown) => {
  const text = Array.isArray(data)
    ? `[\n${data.map((item) => JSON.stringify(item)).join(',\n')}\n]\n`
    : `${JSON.stringify(data, null, 1)}\n`;
  writeFileSync(join(OUT, name), text, 'utf8');
};

const csv = readFileSync(join(ROOT, 'resources', 'britfone', 'britfone.main.3.0.1.csv'), 'utf8');
const lexicon = new Lexicon();
lexicon.loadBritfone(csv);
const pronsOf = (w: string) => lexicon.pronsOf(w);

// --- Léxico: la transcripción Longman de cada palabra de Britfone -----------------------------
const keys = new Set<string>();
for (const line of csv.split(/\r?\n/)) {
  const comma = line.indexOf(',');
  if (comma <= 0) continue;
  const raw = line.slice(0, comma).replace(/\(\d+\)$/, '').replace(/_/g, ' ').trim();
  if (raw) keys.add(normalizeKey(raw === 'I' ? 'I' : raw.toLowerCase()));
}
const lexiconLines = [...keys].map((k) => {
  const p = lexicon.pronsOf(k);
  return `${k}\t${p ? `${p.source}\t${p.prons.join(' | ')}` : 'null'}`;
});
writeFileSync(
  join(OUT, 'lexico-britfone.tsv'),
  `# total=${lexicon.info().total} fromLdoce=${lexicon.info().fromLdoce}\n${lexiconLines.join('\n')}\n`,
  'utf8',
);

// --- Orden de localeCompare (último criterio de orden de las búsquedas) -------------------------
const orderSample = [
  ...new Set([
    ...keys,
    'I', 'Café', 'café', 'cafe', 'Cafe', 'co-op', 'co op', "co'op", 'Wednesday', 'naïve', 'naive',
    'résumé', 'resume', 'x-ray', 'X-ray', "o'clock", '3D', 'a.m.', 'A', 'a', 'Ångström', 'über',
    'Über', 'e-mail', 'email', 'E-mail', 'rock and roll', "rock 'n' roll", 'Mr.', 'Mr', 'mr', '2nd',
    '10th', '1st',
  ]),
].sort((a, b) => a.localeCompare(b));
writeFileSync(join(OUT, 'orden-localecompare.txt'), `${orderSample.join('\n')}\n`, 'utf8');

// --- Búsqueda por ortografía ---------------------------------------------------------------------
const spellingQueries = [
  'watre', 'recieve', 'water', 'Water ', 'WATER', 'watered', 'fonetik', 'phonetic', 'beleive',
  'seperate', 'definately', 'nite', 'thru', 'kwik', 'wich', 'nolledge', 'sikology', 'ritten',
  'acommodate', 'a', 'i', 'I', 'the', 'x', 'zz', 'qu', '', '   ', "don't", 'dont', "o'clock",
  'ice cream', 'ice-cream', 'café', 'naïve', 'photo', 'foto', 'night', 'nght', 'knowledge',
  'psychology', 'wrist', 'rist', 'chaos', 'kaos', 'phone', 'fone', 'enough', 'enuf', 'tough',
  'tuf', 'colour', 'color', 'theatre', 'center', 'centre', 'schedule', 'shedule', 'skedule',
  'Wednesday', 'wensday', 'february', 'febuary', 'library', 'libary', 'comfortable',
  'comfterble', 'vegetable', 'vejtable', 'island', 'iland', 'receipt', 'reciet', 'listen',
  'lisen', 'castle', 'casle', 'wat', 'inter', 'un', 'pro', 'ab', 'st', 'ship', 'sheep', 'thought',
  'thot', 'through', 'threw', 'judge', 'juj', 'church', 'cherch', 'pleasure', 'plezhur',
  'beautiful', 'butiful', 'restaurant', 'restaraunt', 'government', 'goverment', 'tomorrow',
  'tommorow', 'necessary', 'neccessary', 'pronunciation', 'pronounciation', 'xylophone',
  'zylofone', 'quay', 'key', 'wh', 'tch', 'dge', 'ck', 'ph', '123', '!!', 'ʃɪp', "rock'n'roll",
  'Mr', 'ok', 'tv', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
];
save('busquedas-ortografia.json', [
  ...spellingQueries.map((query) => ({ query, limit: 25, result: lexicon.searchSpelling(query, 25) })),
  ...['wat', 'water', 'fone'].map((query) => ({ query, limit: 5, result: lexicon.searchSpelling(query, 5) })),
  ...['st', 'pro'].map((query) => ({ query, limit: 100, result: lexicon.searchSpelling(query, 100) })),
]);

// --- Búsqueda por fonemas --------------------------------------------------------------------------
const phonemeQueries = [
  'nəʊ', 'ˈwɔːtər', 'ˈwɔːtə', 'wɔːˈtə', 'ʃɪp', 'ʃiːp', 'kæt', 'kʌt', 'θɪŋk', 'sɪŋk', 'ðɪs', 'həʊm',
  'ˈfəʊtəɡrɑːf', 'fəˈtɒɡrəfi', 'ˌfəʊtəˈɡræfɪk', 'tʃɜːtʃ', 'dʒʌdʒ', 'ˈpleʒə', 'ˈvɪʒn', 'juː', 'aɪ',
  'ə', 'r', 'ˈ', 'p', 'ðə', 'ˈkʌmftəbl', 'ˈskedjuːl', 'ˈʃedjuːl', 'bɜːd', 'bed', 'bæd', 'ɪŋˈɡlɪʃ',
  'ˈɪŋɡlɪʃ', 'ˈwenzdeɪ', 'ˈlaɪbrəri', 'ˈveʤtəbl', 'ˈaɪlənd', 'rɪˈsiːt', 'ˈlɪsn', 'ˈkɑːsl', 'naɪt',
  'nolɪdʒ', 'ˈnɒlɪdʒ', 'saɪˈkɒlədʒi', 'ˈkeɪɒs', 'fəʊn', 'ɪˈnʌf', 'tʌf', 'ˈkʌlə', 'ˈθɪətə', 'ˈsentə',
  'ˈɡʌvəmənt', 'ˈɡʌvmənt', 'təˈmɒrəʊ', 'ˈnesəsəri', 'prəˌnʌnsiˈeɪʃn', 'ˈzaɪləfəʊn', 'kiː',
  'ˌʌndəˈstænd', 'ʌndəˈstænd', 'ɪkˈstriːm', 'kəmˈpjuːtə', 'ˈtʃaɪəˈθiːə', 'mɪˈstɜːrɪəs', 'ˌiːtʃ',
  'ˈhæpi', 'ˈhæpɪ', 'sɪtʃuˈeɪʃn', 'ˈbjuːtɪfl', 'ˈrestrɒnt', 'ʌ', 'ɑːɑːɑːɑːɑːɑːɑːɑː',
];
const phonemeResults: unknown[] = [];
for (const text of phonemeQueries) {
  const phonemes = tokenize(text).tokens;
  for (const useStress of [false, true]) {
    const limit = phonemeResults.length < 10 ? 40 : 12;
    phonemeResults.push({
      phonemes,
      useStress,
      limit,
      result: lexicon.searchPhonemes(phonemes, { useStress, limit }),
    });
  }
}
phonemeResults.push({
  phonemes: tokenize('kæt').tokens,
  useStress: false,
  limit: 3,
  result: lexicon.searchPhonemes(tokenize('kæt').tokens, { useStress: false, limit: 3 }),
});
save('busquedas-fonemas.json', phonemeResults);

// --- Oraciones (transcripción, procesos, notación eSpeak) ----------------------------------------
const connected: SentenceOptions = { connected: true, forcedStrong: [], forcedWeak: [] };
const citation: SentenceOptions = { connected: false, forcedStrong: [], forcedWeak: [] };
const sentences = [
  "Where are you from? I'm fine, thanks.",
  'The cat sat on the mat.',
  'I ate the apple.',
  'Where are you from?',
  'I gave it to her.',
  'I want to go.',
  'Her car is red.',
  'There is a book over there.',
  'I have seen it.',
  'I have a car.',
  'I know that.',
  'There is a lot of water in it.',
  'It is far away.',
  'Yes, I can. Thanks.',
  'I watered the plants.',
  'She is watering them.',
  'The end.',
  'Ten boys came.',
  'Look at that cat.',
  'This shop is open.',
  'See you next day.',
  "Don't you know?",
  'The idea of it.',
  "I'd like it.",
  "We'll see.",
  "They're here.",
  "John's car is new.",
  'A well-known artist.',
  'She’s watering the flowers.',
  'The cats watched the dogs.',
  'An honest hour!',
  'Do you like it?',
  'What does she want?',
  'I have to go.',
  'Some of them came.',
  'Some people say that.',
  'I like that book.',
  'He has done it.',
  'Law and order.',
  'Is it far?',
  'Run, run, run!',
  'Would you like tea?',
  'Did you eat it?',
  'Ten men and ten mice.',
  'Good boy; good girl: (yes) — no "maybe".',
  'Hello…   world',
  '',
  '   ',
  '123 456',
  'Xyzzy plugh quux.',
  'The university is useful.',
  'An umbrella, a euro, one apple.',
  'He stopped running and stopped.',
  'They studied the fixes and boxes.',
  'Must I? You must.',
  'I must eat.',
  'And the answer is: and.',
  'Can you swim? I can.',
  'Was it him? It was.',
  'We were there. Were we?',
  'He would, but she will not.',
  'Shall we dance? We should.',
  'It could be the best.',
  "Don't do that, do this.",
  'Does he? He does.',
  'Them and us, him and her.',
  'Been there, done that.',
  'Am I late? I am.',
  'His book is better than hers.',
  'She has been to Paris as a student.',
  'Is he at home or at work?',
  'For her, for him, for us.',
  'Your idea is far better than theirs.',
  'Give me some, please.',
  'More ice, more apples, four eggs.',
  'The sofa is in the corner.',
  'Put the media on the table.',
  'Get your coat and hat.',
  'Mr Brown is here.',
  ...DICTATION_LEVELS.filter((l) => l.phrases).flatMap((l) => l.items),
  ...GRAMMAR_EXERCISES.map(exerciseSentence),
];
const sentenceCases: Array<{ text: string; options: SentenceOptions }> = [];
for (const text of sentences) {
  sentenceCases.push({ text, options: connected }, { text, options: citation });
}
// Formas forzadas por el alumno.
sentenceCases.push(
  { text: 'I want to go.', options: { connected: true, forcedStrong: [2], forcedWeak: [] } },
  { text: 'I know that.', options: { connected: true, forcedStrong: [], forcedWeak: [2] } },
  { text: 'I know that.', options: { connected: false, forcedStrong: [], forcedWeak: [2] } },
  { text: 'Where are you from?', options: { connected: true, forcedStrong: [1, 2], forcedWeak: [3] } },
  { text: 'There is a book over there.', options: { connected: true, forcedStrong: [0], forcedWeak: [5] } },
  { text: 'I gave it to her.', options: { connected: true, forcedStrong: [4], forcedWeak: [3] } },
  { text: 'The cat sat on the mat.', options: { connected: true, forcedStrong: [0, 4, 99], forcedWeak: [0] } },
);
save(
  'oraciones.json',
  sentenceCases.map(({ text, options }) => {
    const deps = { pronsOf, longmanForms: () => null };
    const analysis = analyzeSentence(text, options, deps);
    return {
      text,
      options,
      analysis,
      espeak: sentenceToEspeak(text, analyzeSentence(text, options, deps), false),
      espeakWithProcesses: sentenceToEspeak(text, analyzeSentence(text, options, deps), true),
    };
  }),
);

// --- Notación eSpeak de palabras sueltas (tts:phonemes) -----------------------------------------
const espeakProns = new Set<string>([
  'kəmˈpjuːtə', 'kæt', 'hɪə', 'ˈred', 'ðə', 'ˈɡʌv(ə)mənt', 'ˌʌndəˈstænd', 'ˈʃedjuːl, ˈske-', '',
  'xyz', 'ˈˈkæt', 'ˌkæt', 'ɑːˈ', '(ə)nd', 'sɪtʃuˈeɪʃn',
]);
for (const { example } of PHONEMES) {
  const p = lexicon.pronsOf(example)?.prons[0];
  if (p) espeakProns.add(p);
}
for (const level of DICTATION_LEVELS.filter((l) => !l.phrases)) {
  for (const item of level.items) {
    const p = lexicon.pronsOf(item)?.prons[0];
    if (p) espeakProns.add(p);
  }
}
save(
  'espeak.json',
  [...espeakProns].map((pron) => ({
    pron,
    keep: wordToEspeak(pron, 'keep'),
    ensure: wordToEspeak(pron, 'ensure'),
    none: wordToEspeak(pron, 'none'),
  })),
);

// --- Herramientas de estudio ---------------------------------------------------------------------
const verbs = [
  ...new Set([
    ...IRREGULAR_VERBS.map((v) => v.base),
    'stop', 'play', 'want', 'watch', 'laugh', 'study', 'love', 'need', 'wash', 'fix', 'buzz',
    'try', 'cry', 'decide', 'hope', 'plan', 'visit', 'open', 'answer', 'enjoy', 'reach', 'judge',
    'kiss', 'bake', 'xyz', '', '  Walk ', 'go', 'echo', 'veto', 'stay', 'obey', 'water', 'offer',
    'prefer', 'refer', 'fear', 'clear',
  ]),
];
const checks: Array<[string, string]> = [
  ['ˈwɔːtə', 'ˈwɔːtə'],
  ['wɔːtər', 'ˈwɔːtə'],
  ['ɡʌvmənt', 'ˈɡʌv(ə)mənt'],
  ['skedjuːl', 'ˈʃedjuːl, ˈske-'],
  ['', 'kæt'],
  ['kæt', ''],
  ['kæt', 'xyz'],
  ['ʃɪp', 'ʃiːp'],
  ['ʃiːp', 'ʃiːp'],
  ['bed', 'bæd'],
  ['aɪ wɒnt tə ɡəʊ', 'aɪ ˈwɒnt tə ˈɡəʊ'],
  ['ðə', 'ðə; strong ðiː'],
  ['fiʃ ən tʃɪps', 'fɪʃ ən ˈtʃɪps'],
];
for (const level of DICTATION_LEVELS) {
  for (const item of level.items.slice(0, 4)) {
    const p = lexicon.pronsOf(item)?.prons[0];
    if (p) checks.push([p.replace(/ɪ/g, 'iː'), p], [p, p]);
  }
}
save('estudio-inflexiones.json', verbs.map((verb) => ({ verb, result: inflections(verb, pronsOf) })));
save(
  'estudio-correcciones.json',
  checks.map(([written, expected]) => {
    const tokens = tokenize(written).tokens;
    return { written: tokens, expected, result: checkTranscription(tokens, expected) };
  }),
);
save(
  'estudio-prons.json',
  [
    ...new Set([
      ...MINIMAL_PAIRS.flatMap((s) => s.pairs.flat()),
      'I', 'i', 'Water', ' water ', 'record', "don't", 'xyz', '',
    ]),
  ].map((word) => ({ word, result: lexicon.pronsOf(word) })),
);

// --- Gramática: todas las oraciones del fixture de spaCy -----------------------------------------
const parses = JSON.parse(
  readFileSync(join(ROOT, 'electron', 'test', 'fixtures', 'spacy-parses.json'), 'utf8'),
) as Record<string, ParsedToken[]>;
save(
  'gramatica.json',
  Object.entries(parses).map(([sentence, tokens]) => ({ sentence, result: analyzeGrammar(tokens) })),
);

console.log(`ok  ${OUT}`);
