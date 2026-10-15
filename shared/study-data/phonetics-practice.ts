/**
 * Material para las prácticas de fonética: palabras y frases del dictado y pares mínimos.
 * Elegido para hispanohablantes: contrastes que no existen en castellano y palabras cuya
 * ortografía engaña.
 */

export interface DictationLevel {
  id: string;
  label: string;
  description: string;
  items: string[];
  /** Las frases se transcriben con formas débiles (habla conectada). */
  phrases?: boolean;
}

export const DICTATION_LEVELS: readonly DictationLevel[] = [
  {
    id: 'vowels',
    label: 'Vocales y diptongos',
    description: 'Monosílabos para distinguir vocales largas, cortas y diptongos.',
    items: [
      'ship',
      'sheep',
      'bed',
      'bad',
      'cup',
      'cart',
      'hot',
      'caught',
      'put',
      'food',
      'bird',
      'face',
      'price',
      'choice',
      'goat',
      'mouth',
      'near',
      'hair',
      'cure',
      'heart',
    ],
  },
  {
    id: 'consonants',
    label: 'Consonantes',
    description:
      'Sonidos que no existen o se confunden en castellano: /θ/, /ð/, /ʒ/, /dʒ/, /ŋ/, /h/, /v/…',
    items: [
      'think',
      'this',
      'measure',
      'judge',
      'church',
      'sing',
      'yes',
      'wet',
      'red',
      'very',
      'zoo',
      'shoe',
      'hat',
      'thin',
      'then',
      'vision',
      'jam',
      'young',
      'whale',
      'lamb',
    ],
  },
  {
    id: 'spelling',
    label: 'Ortografía engañosa',
    description: 'Palabras que no se pronuncian como se escriben.',
    items: [
      'island',
      'knee',
      'castle',
      'Wednesday',
      'answer',
      'listen',
      'half',
      'walk',
      'could',
      'women',
      'busy',
      'said',
      'again',
      'laugh',
      'cough',
      'daughter',
      'thought',
      'though',
      'through',
      'enough',
      'comfortable',
      'vegetable',
      'chocolate',
      'colleague',
    ],
  },
  {
    id: 'stress',
    label: 'Polisílabos y acento',
    description: 'Palabras largas: cuidado con la sílaba acentuada y las vocales débiles.',
    items: [
      'photograph',
      'photographer',
      'photographic',
      'economy',
      'economic',
      'banana',
      'potato',
      'computer',
      'particular',
      'university',
      'information',
      'necessary',
      'interesting',
      'development',
      'hotel',
      'record',
    ],
  },
  {
    id: 'phrases',
    label: 'Frases con formas débiles',
    description: 'Habla conectada: function words en forma débil y r de enlace.',
    phrases: true,
    items: [
      'a cup of tea',
      'fish and chips',
      'at the station',
      'I want to go',
      'for an hour',
      'from London to Paris',
      'some bread and butter',
      'Where are you from?',
      'Tell her to wait.',
      'There are two of them.',
      'He was at home.',
      'What do you want?',
      'I can swim.',
    ],
  },
];

export interface MinimalPairSet {
  id: string;
  /** Los dos fonemas que se contrastan. */
  contrast: [string, string];
  /** Por qué cuesta, en castellano. */
  hint: string;
  pairs: Array<[string, string]>;
}

export const MINIMAL_PAIRS: readonly MinimalPairSet[] = [
  {
    id: 'i-ii',
    contrast: ['iː', 'ɪ'],
    hint: 'El castellano tiene una sola /i/: /iː/ es larga y tensa; /ɪ/, corta y más abierta.',
    pairs: [
      ['sheep', 'ship'],
      ['leave', 'live'],
      ['feel', 'fill'],
      ['seat', 'sit'],
      ['beat', 'bit'],
      ['heel', 'hill'],
    ],
  },
  {
    id: 'ae-uh',
    contrast: ['æ', 'ʌ'],
    hint: 'Las dos suenan como «a» para un hispanohablante: /æ/ es más abierta y anterior.',
    pairs: [
      ['cat', 'cut'],
      ['bag', 'bug'],
      ['hat', 'hut'],
      ['match', 'much'],
      ['ran', 'run'],
      ['cap', 'cup'],
    ],
  },
  {
    id: 'ae-e',
    contrast: ['æ', 'e'],
    hint: '/æ/ está entre la «a» y la «e» del castellano; /e/ es más cerrada.',
    pairs: [
      ['bad', 'bed'],
      ['man', 'men'],
      ['sat', 'set'],
      ['had', 'head'],
      ['pan', 'pen'],
    ],
  },
  {
    id: 'aa-uh',
    contrast: ['ɑː', 'ʌ'],
    hint: '/ɑː/ es larga y posterior; /ʌ/, corta y central.',
    pairs: [
      ['cart', 'cut'],
      ['heart', 'hut'],
      ['calm', 'come'],
      ['march', 'much'],
      ['dark', 'duck'],
    ],
  },
  {
    id: 'o-oo',
    contrast: ['ɒ', 'ɔː'],
    hint: '/ɒ/ es corta y abierta; /ɔː/, larga y con labios más redondeados.',
    pairs: [
      ['cot', 'caught'],
      ['pot', 'port'],
      ['shot', 'short'],
      ['spot', 'sport'],
      ['fox', 'forks'],
    ],
  },
  {
    id: 'u-uu',
    contrast: ['ʊ', 'uː'],
    hint: 'El castellano tiene una sola /u/: /uː/ es larga; /ʊ/, corta y relajada.',
    pairs: [
      ['full', 'fool'],
      ['pull', 'pool'],
      ['soot', 'suit'],
    ],
  },
  {
    id: 'er-ar',
    contrast: ['ɜː', 'ɑː'],
    hint: '/ɜː/ (bird) es central, sin equivalente en castellano; /ɑː/ es abierta y posterior.',
    pairs: [
      ['heard', 'hard'],
      ['firm', 'farm'],
      ['hurt', 'heart'],
      ['burn', 'barn'],
      ['curt', 'cart'],
    ],
  },
  {
    id: 'ou-oo',
    contrast: ['əʊ', 'ɔː'],
    hint: '/əʊ/ es un diptongo que empieza central; /ɔː/ es una vocal larga, sin deslizamiento.',
    pairs: [
      ['coat', 'caught'],
      ['boat', 'bought'],
      ['low', 'law'],
      ['so', 'saw'],
      ['hole', 'hall'],
    ],
  },
  {
    id: 'b-v',
    contrast: ['b', 'v'],
    hint: 'En castellano b y v suenan igual; en inglés /v/ es labiodental (dientes sobre el labio).',
    pairs: [
      ['berry', 'very'],
      ['ban', 'van'],
      ['best', 'vest'],
      ['boat', 'vote'],
      ['bet', 'vet'],
    ],
  },
  {
    id: 's-th',
    contrast: ['s', 'θ'],
    hint: '/θ/ se articula con la lengua entre los dientes (como la «z» peninsular).',
    pairs: [
      ['sink', 'think'],
      ['sick', 'thick'],
      ['mouse', 'mouth'],
      ['pass', 'path'],
      ['sum', 'thumb'],
    ],
  },
  {
    id: 'd-dh',
    contrast: ['d', 'ð'],
    hint: '/ð/ es fricativa (como la «d» suave de «cada»); /d/ es oclusiva.',
    pairs: [
      ['day', 'they'],
      ['dare', 'there'],
      ['den', 'then'],
      ['dough', 'though'],
      ['doze', 'those'],
    ],
  },
  {
    id: 's-z',
    contrast: ['s', 'z'],
    hint: 'El castellano rioplatense no tiene /z/ sonora en estas posiciones.',
    pairs: [
      ['sip', 'zip'],
      ['price', 'prize'],
      ['bus', 'buzz'],
      ['place', 'plays'],
      ['loose', 'lose'],
    ],
  },
  {
    id: 'sh-ch',
    contrast: ['ʃ', 'tʃ'],
    hint: '/ʃ/ es fricativa (como la «sh» rioplatense); /tʃ/ tiene un cierre previo (como la «ch»).',
    pairs: [
      ['ship', 'chip'],
      ['share', 'chair'],
      ['wash', 'watch'],
      ['sheep', 'cheap'],
      ['cash', 'catch'],
    ],
  },
  {
    id: 'j-dj',
    contrast: ['j', 'dʒ'],
    hint: '/j/ es una semivocal (como la «i» de «tiene»); /dʒ/ es africada.',
    pairs: [
      ['yet', 'jet'],
      ['yell', 'gel'],
      ['year', 'jeer'],
      ['yam', 'jam'],
      ['yolk', 'joke'],
    ],
  },
  {
    id: 'n-ng',
    contrast: ['n', 'ŋ'],
    hint: '/ŋ/ se articula con la parte posterior de la lengua, sin /ɡ/ final.',
    pairs: [
      ['thin', 'thing'],
      ['ban', 'bang'],
      ['sin', 'sing'],
      ['ran', 'rang'],
      ['win', 'wing'],
    ],
  },
  {
    id: 'h-0',
    contrast: ['h', '∅'],
    hint: '/h/ es una aspiración suave, no la «j» castellana; y no se omite.',
    pairs: [
      ['hear', 'ear'],
      ['heat', 'eat'],
      ['hair', 'air'],
      ['hold', 'old'],
      ['hill', 'ill'],
    ],
  },
];
