/**
 * Verbos irregulares más frecuentes: forma base, pasado y participio (inglés británico).
 * Las variantes van separadas por " / " (learnt / learned). La transcripción de cada forma sale
 * del diccionario de la app; `prons` sólo se completa cuando la ortografía es ambigua
 * (read pasado /red/, wind /waɪnd/ y no /wɪnd/, tear /teə/ y no /tɪə/).
 */

export interface IrregularVerb {
  base: string;
  past: string;
  participle: string;
  /** Significado aproximado en castellano. */
  meaning: string;
  /** Transcripciones fijas para ortografías ambiguas, por forma. */
  prons?: Partial<Record<'base' | 'past' | 'participle', string>>;
  note?: string;
}

const v = (
  base: string,
  past: string,
  participle: string,
  meaning: string,
  extra: Pick<IrregularVerb, 'prons' | 'note'> = {},
): IrregularVerb => ({ base, past, participle, meaning, ...extra });

export const IRREGULAR_VERBS: readonly IrregularVerb[] = [
  v('arise', 'arose', 'arisen', 'surgir'),
  v('awake', 'awoke', 'awoken', 'despertar(se)'),
  v('be', 'was / were', 'been', 'ser, estar'),
  v('bear', 'bore', 'borne', 'soportar'),
  v('beat', 'beat', 'beaten', 'golpear, vencer'),
  v('become', 'became', 'become', 'convertirse en'),
  v('begin', 'began', 'begun', 'empezar'),
  v('bend', 'bent', 'bent', 'doblar'),
  v('bet', 'bet', 'bet', 'apostar'),
  v('bind', 'bound', 'bound', 'atar'),
  v('bite', 'bit', 'bitten', 'morder'),
  v('bleed', 'bled', 'bled', 'sangrar'),
  v('blow', 'blew', 'blown', 'soplar'),
  v('break', 'broke', 'broken', 'romper'),
  v('breed', 'bred', 'bred', 'criar'),
  v('bring', 'brought', 'brought', 'traer'),
  v('broadcast', 'broadcast', 'broadcast', 'transmitir'),
  v('build', 'built', 'built', 'construir'),
  v('burn', 'burnt / burned', 'burnt / burned', 'quemar'),
  v('burst', 'burst', 'burst', 'reventar'),
  v('buy', 'bought', 'bought', 'comprar'),
  v('catch', 'caught', 'caught', 'atrapar'),
  v('choose', 'chose', 'chosen', 'elegir'),
  v('cling', 'clung', 'clung', 'aferrarse'),
  v('come', 'came', 'come', 'venir'),
  v('cost', 'cost', 'cost', 'costar'),
  v('creep', 'crept', 'crept', 'arrastrarse'),
  v('cut', 'cut', 'cut', 'cortar'),
  v('deal', 'dealt', 'dealt', 'tratar, repartir'),
  v('dig', 'dug', 'dug', 'cavar'),
  v('do', 'did', 'done', 'hacer'),
  v('draw', 'drew', 'drawn', 'dibujar'),
  v('dream', 'dreamt / dreamed', 'dreamt / dreamed', 'soñar'),
  v('drink', 'drank', 'drunk', 'beber'),
  v('drive', 'drove', 'driven', 'conducir'),
  v('eat', 'ate', 'eaten', 'comer', { note: 'En RP el pasado es /et/ (también /eɪt/).' }),
  v('fall', 'fell', 'fallen', 'caer'),
  v('feed', 'fed', 'fed', 'alimentar'),
  v('feel', 'felt', 'felt', 'sentir'),
  v('fight', 'fought', 'fought', 'pelear'),
  v('find', 'found', 'found', 'encontrar'),
  v('flee', 'fled', 'fled', 'huir'),
  v('fly', 'flew', 'flown', 'volar'),
  v('forbid', 'forbade', 'forbidden', 'prohibir'),
  v('forget', 'forgot', 'forgotten', 'olvidar'),
  v('forgive', 'forgave', 'forgiven', 'perdonar'),
  v('freeze', 'froze', 'frozen', 'congelar'),
  v('get', 'got', 'got', 'conseguir, llegar', { note: '«gotten» es el participio americano.' }),
  v('give', 'gave', 'given', 'dar'),
  v('go', 'went', 'gone', 'ir'),
  v('grind', 'ground', 'ground', 'moler'),
  v('grow', 'grew', 'grown', 'crecer'),
  v('hang', 'hung', 'hung', 'colgar'),
  v('have', 'had', 'had', 'tener'),
  v('hear', 'heard', 'heard', 'oír'),
  v('hide', 'hid', 'hidden', 'esconder'),
  v('hit', 'hit', 'hit', 'golpear'),
  v('hold', 'held', 'held', 'sostener'),
  v('hurt', 'hurt', 'hurt', 'lastimar'),
  v('keep', 'kept', 'kept', 'mantener, guardar'),
  v('kneel', 'knelt', 'knelt', 'arrodillarse'),
  v('know', 'knew', 'known', 'saber, conocer'),
  v('lay', 'laid', 'laid', 'poner, tender'),
  v('lead', 'led', 'led', 'guiar', { prons: { base: 'liːd' } }),
  v('lean', 'leant / leaned', 'leant / leaned', 'apoyarse'),
  v('leap', 'leapt / leaped', 'leapt / leaped', 'saltar'),
  v('learn', 'learnt / learned', 'learnt / learned', 'aprender'),
  v('leave', 'left', 'left', 'dejar, irse'),
  v('lend', 'lent', 'lent', 'prestar'),
  v('let', 'let', 'let', 'permitir'),
  v('lie', 'lay', 'lain', 'yacer, estar acostado', {
    note: '«lie» (mentir) es regular: lied, lied.',
  }),
  v('light', 'lit', 'lit', 'encender'),
  v('lose', 'lost', 'lost', 'perder'),
  v('make', 'made', 'made', 'hacer, fabricar'),
  v('mean', 'meant', 'meant', 'significar'),
  v('meet', 'met', 'met', 'conocer, encontrarse'),
  v('pay', 'paid', 'paid', 'pagar'),
  v('put', 'put', 'put', 'poner'),
  v('quit', 'quit', 'quit', 'dejar, abandonar'),
  v('read', 'read', 'read', 'leer', {
    prons: { base: 'riːd', past: 'red', participle: 'red' },
    note: 'Mismas letras, distinta pronunciación: /riːd/, /red/, /red/.',
  }),
  v('ride', 'rode', 'ridden', 'montar, andar en'),
  v('ring', 'rang', 'rung', 'sonar, llamar'),
  v('rise', 'rose', 'risen', 'subir, elevarse'),
  v('run', 'ran', 'run', 'correr'),
  v('say', 'said', 'said', 'decir', { note: 'Ojo: «said» es /sed/, no /seɪd/.' }),
  v('see', 'saw', 'seen', 'ver'),
  v('seek', 'sought', 'sought', 'buscar'),
  v('sell', 'sold', 'sold', 'vender'),
  v('send', 'sent', 'sent', 'enviar'),
  v('set', 'set', 'set', 'fijar, poner'),
  v('sew', 'sewed', 'sewn', 'coser', { prons: { base: 'səʊ', past: 'səʊd', participle: 'səʊn' } }),
  v('shake', 'shook', 'shaken', 'sacudir'),
  v('shine', 'shone', 'shone', 'brillar', { note: 'En RP «shone» es /ʃɒn/.' }),
  v('shoot', 'shot', 'shot', 'disparar'),
  v('show', 'showed', 'shown', 'mostrar'),
  v('shrink', 'shrank', 'shrunk', 'encoger'),
  v('shut', 'shut', 'shut', 'cerrar'),
  v('sing', 'sang', 'sung', 'cantar'),
  v('sink', 'sank', 'sunk', 'hundir(se)'),
  v('sit', 'sat', 'sat', 'sentarse'),
  v('sleep', 'slept', 'slept', 'dormir'),
  v('slide', 'slid', 'slid', 'deslizar(se)'),
  v('smell', 'smelt / smelled', 'smelt / smelled', 'oler'),
  v('speak', 'spoke', 'spoken', 'hablar'),
  v('spell', 'spelt / spelled', 'spelt / spelled', 'deletrear'),
  v('spend', 'spent', 'spent', 'gastar, pasar (tiempo)'),
  v('spill', 'spilt / spilled', 'spilt / spilled', 'derramar'),
  v('spin', 'spun', 'spun', 'girar'),
  v('spit', 'spat', 'spat', 'escupir'),
  v('split', 'split', 'split', 'dividir'),
  v('spoil', 'spoilt / spoiled', 'spoilt / spoiled', 'arruinar, malcriar'),
  v('spread', 'spread', 'spread', 'extender, untar'),
  v('spring', 'sprang', 'sprung', 'saltar, brotar'),
  v('stand', 'stood', 'stood', 'estar de pie'),
  v('steal', 'stole', 'stolen', 'robar'),
  v('stick', 'stuck', 'stuck', 'pegar'),
  v('sting', 'stung', 'stung', 'picar'),
  v('stink', 'stank', 'stunk', 'apestar'),
  v('strike', 'struck', 'struck', 'golpear'),
  v('swear', 'swore', 'sworn', 'jurar, insultar'),
  v('sweep', 'swept', 'swept', 'barrer'),
  v('swim', 'swam', 'swum', 'nadar'),
  v('swing', 'swung', 'swung', 'balancear(se)'),
  v('take', 'took', 'taken', 'tomar, llevar'),
  v('teach', 'taught', 'taught', 'enseñar'),
  v('tear', 'tore', 'torn', 'rasgar', {
    prons: { base: 'teə' },
    note: '«tear» (lágrima) es /tɪə/.',
  }),
  v('tell', 'told', 'told', 'contar, decir'),
  v('think', 'thought', 'thought', 'pensar'),
  v('throw', 'threw', 'thrown', 'tirar, lanzar'),
  v('tread', 'trod', 'trodden', 'pisar'),
  v('understand', 'understood', 'understood', 'entender'),
  v('wake', 'woke', 'woken', 'despertar(se)'),
  v('wear', 'wore', 'worn', 'llevar puesto'),
  v('weave', 'wove', 'woven', 'tejer'),
  v('weep', 'wept', 'wept', 'llorar'),
  v('win', 'won', 'won', 'ganar', { prons: { past: 'wʌn', participle: 'wʌn' } }),
  v('wind', 'wound', 'wound', 'enrollar, dar cuerda', {
    prons: { base: 'waɪnd', past: 'waʊnd', participle: 'waʊnd' },
    note: '«wind» (viento) es /wɪnd/ y «wound» (herida) es /wuːnd/.',
  }),
  v('write', 'wrote', 'written', 'escribir'),
];

/** Patrón de formas: AAA (cut-cut-cut), ABB (keep-kept-kept), ABA (come-came-come), ABC (go-went-gone). */
export type VerbPattern = 'AAA' | 'ABB' | 'ABA' | 'ABC';

export function verbPattern(verb: IrregularVerb): VerbPattern {
  const [a, b, c] = [verb.base, verb.past, verb.participle].map((f) => f.split(' / ')[0]);
  if (a === b && b === c && !verb.prons?.past) return 'AAA';
  if (b === c) return 'ABB';
  if (a === c) return 'ABA';
  return 'ABC';
}
