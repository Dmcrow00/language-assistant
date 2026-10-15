import type {
  ClauseAnalysis,
  ClauseElement,
  ClauseKind,
  ElementRole,
  GrammarAnalysis,
  GrammarToken,
  PhraseForm,
  SentenceGrammar,
  StructurePart,
  TokenSpan,
  VerbPhraseAnalysis,
  VerbPartRole,
} from '../../shared/grammar';
import type { ParsedToken } from './nlp-client';

/**
 * Interpretación del árbol de dependencias de spaCy en términos de Quirk / Greenbaum.
 *
 * spaCy da, para cada palabra, su núcleo y la relación (nsubj, dobj, prep…). Acá se traduce:
 *   nsubj → S · verbo + auxiliares → V · dobj → Od · dative → Oi · attr/acomp → Cs · oprd → Co
 *   prep/advmod/advcl/agent → A · ccomp/xcomp/csubj → cláusula nominal · advcl → adverbial · relcl → relativa
 * y se corrigen algunos errores típicos del modelo en los patrones de manual (ver `fixElement`).
 */

const VERB_GROUP_DEPS = new Set(['aux', 'auxpass', 'neg', 'prt']);
/** Palabras del adverbial de tiempo que spaCy a veces cuelga del adjetivo (open on Sundays). */
const TIME_WORDS = new Set(
  (
    'monday tuesday wednesday thursday friday saturday sunday weekend morning afternoon evening ' +
    'night day week month year summer winter spring autumn holiday christmas time ' +
    'january february march april may june july august september october november december'
  ).split(' '),
);
const SUBJECT_DEPS = new Set(['nsubj', 'nsubjpass', 'csubj', 'csubjpass', 'expl']);
const ADVERBIAL_DEPS = new Set([
  'prep',
  'advmod',
  'npadvmod',
  'advcl',
  'agent',
  'tmod',
  'obl',
  'nmod',
  // "never", "no longer"…: spaCy los marca como negación, pero para Quirk son adverbiales.
  'neg',
]);
const CLAUSE_DEPS = new Set([
  'ccomp',
  'xcomp',
  'advcl',
  'csubj',
  'csubjpass',
  'relcl',
  'acl',
  'pcomp',
]);
const IGNORED_DEPS = new Set([
  'punct',
  'mark',
  'cc',
  'conj',
  'intj',
  'parataxis',
  'dep',
  'meta',
  'discourse',
]);

/** Verbos copulativos: lo que sigue es complemento del sujeto (The soup tasted delicious). */
const LINKING_VERBS = new Set(
  'be seem appear become get grow turn look sound smell taste feel remain stay keep prove go come fall'.split(
    ' ',
  ),
);
/** Transitivos complejos con complemento del objeto (They elected her president). */
const OBJECT_COMPLEMENT_VERBS = new Set(
  'elect make appoint call name consider find keep leave paint declare crown vote think believe judge prove render drive turn colour color dye'.split(
    ' ',
  ),
);
/** Verbos que piden un adverbial obligatorio: SVA (be in the garden, live in Paris). */
const SVA_VERBS = new Set(
  'be live stay remain lie sit stand go come get last belong reside hang rest'.split(' '),
);
/** Verbos que piden objeto + adverbial obligatorio: SVOA (put the dish on the table). */
const SVOA_VERBS = new Set(
  'put place set lay keep stand send take bring lead show treat hang stick get'.split(' '),
);
/** Preposiciones de lugar: el adverbial obligatorio de put, place, keep… */
const LOCATIVE_PREPOSITIONS = new Set(
  'on in into onto under at behind near beside inside over above below between across'.split(' '),
);
/** Adverbios que nunca son el adverbial obligatorio del patrón. */
const OPTIONAL_ADVERBS = new Set(
  'ever never always often sometimes usually also just already still even only really not'.split(
    ' ',
  ),
);

/** "Sundays", "mornings"…: spaCy no siempre singulariza los nombres propios. */
function isTimeWord(word: string): boolean {
  const w = word.toLowerCase();
  return TIME_WORDS.has(w) || TIME_WORDS.has(w.replace(/s$/, ''));
}

/** Auxiliares, partícula de verbo frasal y "not / n't": lo que forma la frase verbal con el verbo. */
function inVerbGroup(token: ParsedToken): boolean {
  if (token.dep === 'neg') return /^(not|n't|n’t)$/i.test(token.text);
  return VERB_GROUP_DEPS.has(token.dep);
}

class Parse {
  readonly children: number[][];

  constructor(readonly tokens: ParsedToken[]) {
    this.children = tokens.map(() => []);
    for (const t of tokens) if (t.head !== t.i) this.children[t.head].push(t.i);
  }

  kids(i: number, ...deps: string[]): ParsedToken[] {
    return this.children[i]
      .map((c) => this.tokens[c])
      .filter((c) => deps.length === 0 || deps.includes(c.dep));
  }

  /**
   * El subárbol de un token, sin la puntuación de los bordes. Si se excluyen partes (la cláusula
   * coordinada que sigue), se toma el tramo continuo alrededor del núcleo.
   */
  span(i: number, exclude: number[] = []): TokenSpan {
    const members = new Set(this.subtree(i, new Set(exclude)));
    let start = i;
    let end = i + 1;
    while (members.has(start - 1)) start--;
    while (members.has(end)) end++;
    while (start < end - 1 && this.tokens[start].pos === 'PUNCT') start++;
    while (end - 1 > start && this.tokens[end - 1].pos === 'PUNCT') end--;
    return { start, end };
  }

  subtree(i: number, exclude: Set<number> = new Set()): number[] {
    const result = [i];
    for (const c of this.children[i]) if (!exclude.has(c)) result.push(...this.subtree(c, exclude));
    return result;
  }

  text(span: TokenSpan): string {
    return this.tokens
      .slice(span.start, span.end)
      .map((t, k, all) => t.text + (k < all.length - 1 ? t.ws : ''))
      .join('');
  }
}

interface Context {
  parse: Parse;
  subordinates: number;
  verbPhrases: VerbPhraseAnalysis[];
}

export function analyzeGrammar(tokens: ParsedToken[]): GrammarAnalysis {
  const parse = new Parse(tokens);
  const sentences: SentenceGrammar[] = [];
  const starts = tokens.filter((t) => t.sentStart || t.i === 0).map((t) => t.i);
  starts.forEach((start, k) => {
    const end = starts[k + 1] ?? tokens.length;
    const root = tokens.slice(start, end).find((t) => t.dep === 'ROOT');
    if (root) sentences.push(analyzeSentence(parse, root.i, { start, end }));
  });
  return { tokens: tokens.map(toGrammarToken), sentences };
}

function analyzeSentence(parse: Parse, root: number, span: TokenSpan): SentenceGrammar {
  const ctx: Context = { parse, subordinates: 0, verbPhrases: [] };
  const clauses: ClauseAnalysis[] = [
    analyzeClause(ctx, root, 'independiente', coordinatedTail(parse, root)),
  ];
  // Cláusulas coordinadas: verbos unidos al principal con "and", "but", "or"…
  let current = root;
  for (;;) {
    const next = parse.kids(current, 'conj').find((c) => c.pos === 'VERB' || c.pos === 'AUX');
    if (!next) break;
    const clause = analyzeClause(ctx, next.i, 'coordinada', coordinatedTail(parse, next.i));
    const cc = parse.tokens
      .slice(clauses[clauses.length - 1].span.end, next.i)
      .find((t) => t.dep === 'cc');
    if (cc) {
      clause.coordinator = cc.text.toLowerCase();
      clause.label = `cláusula coordinada (${clause.coordinator})`;
    }
    clauses.push(clause);
    current = next.i;
  }
  const text = parse.text(span);
  const independent = clauses.length;
  const structure =
    independent > 1
      ? ctx.subordinates > 0
        ? 'compuesta-compleja'
        : 'compuesta'
      : ctx.subordinates > 0
        ? 'compleja'
        : 'simple';
  const form = /\?\s*$/.test(text)
    ? 'interrogativa'
    : clauses[0].verbPhrase?.imperative
      ? 'imperativa'
      : /^(what|how)\b/i.test(text) && /!\s*$/.test(text)
        ? 'exclamativa'
        : 'declarativa';
  return {
    span,
    text,
    structure,
    form,
    clauses,
    verbPhrases: [...ctx.verbPhrases].sort((a, b) => a.span.start - b.span.start),
    subordinateClauses: ctx.subordinates,
  };
}

/** Lo que hay que sacar del texto de una cláusula para no incluir a la coordinada que le sigue. */
function coordinatedTail(parse: Parse, head: number): number[] {
  const next = parse.kids(head, 'conj').find((c) => c.pos === 'VERB' || c.pos === 'AUX');
  if (!next) return [];
  return [
    next.i,
    ...parse
      .kids(head, 'cc')
      .filter((c) => c.i < next.i)
      .map((c) => c.i),
  ];
}

function analyzeClause(
  ctx: Context,
  head: number,
  kind: ClauseKind,
  excludeFromSpan: number[] = [],
): ClauseAnalysis {
  const { parse } = ctx;
  const headToken = parse.tokens[head];
  if (kind !== 'independiente' && kind !== 'coordinada') ctx.subordinates++;

  const verbPhrase =
    headToken.pos === 'VERB' || headToken.pos === 'AUX'
      ? analyzeVerbPhrase(parse, head)
      : undefined;
  if (verbPhrase) ctx.verbPhrases.push(verbPhrase);

  const elements: ClauseElement[] = [];
  let subordinator: string | undefined;
  const mark = parse.kids(head, 'mark')[0];
  if (mark) subordinator = mark.text.toLowerCase();

  const verbTokens = [
    head,
    ...parse
      .kids(head)
      .filter(inVerbGroup)
      .map((t) => t.i),
  ].sort((a, b) => a - b);
  if (verbPhrase) {
    const pieces = contiguous(verbTokens);
    elements.push({
      role: 'V',
      span: { start: verbTokens[0], end: verbTokens[verbTokens.length - 1] + 1 },
      ...(pieces.length > 1 ? { pieces } : {}),
      text: pieces.map((p) => parse.text(p)).join(' … '),
      form: 'VP',
      formLabel: 'frase verbal (VP)',
    });
  }

  const hasExpletive = parse.kids(head, 'expl').length > 0;
  const hasObject = parse.kids(head, 'dobj').length > 0;
  const lemma = headToken.lemma.toLowerCase();

  for (const child of parse.kids(head)) {
    if (inVerbGroup(child) || IGNORED_DEPS.has(child.dep)) continue;
    // "When it rains": el adverbio wh- al comienzo de una adverbial es el subordinante, no un elemento.
    if (
      kind === 'adverbial' &&
      child.dep === 'advmod' &&
      child.tag === 'WRB' &&
      child.i < head &&
      !subordinator
    ) {
      subordinator = child.text.toLowerCase();
      continue;
    }
    const role = roleOf(child, { lemma, hasExpletive, hasObject, isCopula: lemma === 'be' });
    if (!role) continue;
    elements.push(...fixElement(ctx, child, role, lemma, hasObject));
  }

  elements.sort((a, b) => a.span.start - b.span.start);
  fixInvertedSubject(elements, lemma, verbPhrase);
  const { pattern, note } = clausePattern(elements, lemma, verbPhrase, hasExpletive);
  const notes = note ? [note] : [];
  if (kind === 'coordinada' && !elements.some((e) => e.role === 'S') && !verbPhrase?.imperative) {
    notes.push('Sujeto elíptico: es el mismo de la cláusula anterior.');
  }
  const finiteness = verbPhrase && !verbPhrase.finite ? 'no finita' : 'finita';
  const relative =
    kind === 'relativa'
      ? parse
          .subtree(head)
          .map((i) => parse.tokens[i])
          .find((t) => /^(WDT|WP|WP\$)$/.test(t.tag))
      : undefined;

  const span = parse.span(head, excludeFromSpan);
  return {
    kind,
    finiteness,
    label: clauseLabel(kind, finiteness, verbPhrase, subordinator, relative?.text),
    span,
    text: parse.text(span),
    ...(subordinator ? { subordinator } : {}),
    elements,
    pattern,
    ...(notes.length ? { patternNote: notes.join(' ') } : {}),
    ...(verbPhrase ? { verbPhrase } : {}),
  };
}

/**
 * «In the corner stood an old piano»: con un adverbial de lugar adelantado el sujeto va después
 * del verbo y spaCy lo toma como objeto. Si la cláusula no tiene sujeto y el verbo es de los que
 * piden un adverbial de lugar (stand, lie, come…), ese "objeto" es el sujeto invertido.
 */
function fixInvertedSubject(
  elements: ClauseElement[],
  lemma: string,
  verbPhrase: VerbPhraseAnalysis | undefined,
): void {
  if (!verbPhrase?.finite || verbPhrase.imperative || !SVA_VERBS.has(lemma)) return;
  if (elements.some((e) => e.role === 'S')) return;
  const verbStart = elements.find((e) => e.role === 'V')?.span.start ?? 0;
  const fronted = elements.some(
    (e) => e.role === 'A' && e.span.start < verbStart && (e.form === 'PP' || e.form === 'AdvP'),
  );
  const object = elements.find((e) => e.role === 'Od' && e.span.start > verbStart);
  if (fronted && object) {
    object.role = 'S';
    object.note =
      'Sujeto invertido: va después del verbo porque el adverbial de lugar está adelante.';
  }
}

function roleOf(
  child: ParsedToken,
  verb: { lemma: string; hasExpletive: boolean; hasObject: boolean; isCopula: boolean },
): ElementRole | null {
  if (SUBJECT_DEPS.has(child.dep)) return 'S';
  switch (child.dep) {
    case 'dobj':
      return 'Od';
    case 'dative':
    case 'iobj':
      return child.pos === 'ADP' ? 'A' : 'Oi';
    case 'attr':
      return verb.hasExpletive ? 'S' : 'Cs';
    case 'acomp':
      return verb.hasObject ? 'Co' : 'Cs';
    case 'oprd':
      return 'Co';
    case 'ccomp':
      return verb.isCopula ? 'Cs' : 'Od';
    case 'xcomp':
      return LINKING_VERBS.has(verb.lemma) && verb.lemma !== 'get'
        ? 'Cs'
        : verb.hasObject
          ? 'Co'
          : 'Od';
  }
  return ADVERBIAL_DEPS.has(child.dep) ? 'A' : null;
}

/**
 * Arma el elemento y corrige los errores frecuentes del modelo chico de spaCy:
 * - «The soup tasted delicious»: toma el adjetivo como objeto → complemento del sujeto.
 * - «They painted the walls white»: toma el adjetivo como adverbial → complemento del objeto.
 * - «They elected her president»: une "her president" como posesivo → Od «her» + Co «president».
 */
function fixElement(
  ctx: Context,
  child: ParsedToken,
  role: ElementRole,
  verbLemma: string,
  hasObject: boolean,
): ClauseElement[] {
  const { parse } = ctx;
  const lowercase = child.text === child.text.toLowerCase();
  const bare = parse.kids(child.i, 'det', 'poss', 'predet', 'nummod').length === 0;

  // «The news made everyone happy», «I find this book boring»: spaCy arma una "minicláusula"
  // (el adjetivo como núcleo y el objeto como su sujeto). Quirk: Od + Co.
  if (
    (child.dep === 'ccomp' || child.dep === 'xcomp') &&
    OBJECT_COMPLEMENT_VERBS.has(verbLemma) &&
    (child.pos === 'ADJ' || child.pos === 'NOUN')
  ) {
    const object = parse.kids(child.i, 'nsubj').find((s) => s.i < child.i);
    if (object && parse.kids(child.i, 'aux', 'mark').length === 0) {
      return [element(ctx, object, 'Od'), element(ctx, child, 'Co', phraseForm(child), [object.i])];
    }
  }
  // «They named their daughter Lucy»: el complemento del objeto llega como aposición.
  if (role === 'Od' && OBJECT_COMPLEMENT_VERBS.has(verbLemma)) {
    const complement = parse.kids(child.i, 'appos').find((a) => a.i > child.i);
    if (complement)
      return [element(ctx, child, 'Od', undefined, [complement.i]), element(ctx, complement, 'Co')];
  }
  // «She placed the vase on the table»: el lugar obligatorio llega colgado del objeto.
  if (role === 'Od' && SVOA_VERBS.has(verbLemma) && parse.kids(child.head, 'prep').length === 0) {
    const place = parse
      .kids(child.i, 'prep')
      .find((p) => p.i > child.i && LOCATIVE_PREPOSITIONS.has(p.text.toLowerCase()));
    if (place) return [element(ctx, child, 'Od', undefined, [place.i]), element(ctx, place, 'A')];
  }

  if (
    role === 'Od' &&
    LINKING_VERBS.has(verbLemma) &&
    verbLemma !== 'be' &&
    bare &&
    lowercase &&
    (child.tag === 'JJ' || child.tag === 'NNP')
  ) {
    return [element(ctx, child, 'Cs', 'AdjP')];
  }
  if (
    (role === 'A' || role === 'Cs') &&
    hasObject &&
    child.pos === 'ADJ' &&
    parse.kids(child.i, 'nsubj', 'aux', 'mark').length === 0
  ) {
    return [element(ctx, child, 'Co', 'AdjP')];
  }
  // «Is the museum open on Sundays?»: spaCy cuelga el adverbial de tiempo del adjetivo.
  if ((role === 'Cs' || role === 'Co') && child.pos === 'ADJ') {
    const time = parse
      .kids(child.i, 'prep')
      .filter((p) => p.i > child.i)
      .find((p) => parse.kids(p.i, 'pobj').some((o) => isTimeWord(o.text)));
    if (time) return [element(ctx, child, role, 'AdjP', [time.i]), element(ctx, time, 'A')];
  }
  // «There is a cat on the roof»: spaCy cuelga el lugar del sujeto nocional; Quirk lo analiza como adverbial.
  if (role === 'S' && child.dep === 'attr') {
    const place = parse
      .kids(child.i, 'prep')
      .filter((p) => p.i > child.i)
      .pop();
    if (place) return [element(ctx, child, 'S', undefined, [place.i]), element(ctx, place, 'A')];
  }
  if (role === 'Od' && OBJECT_COMPLEMENT_VERBS.has(verbLemma) && child.pos === 'NOUN') {
    const possessive = parse
      .kids(child.i, 'poss')
      .find((p) => p.text.toLowerCase() === 'her' && p.i < child.i);
    if (possessive && parse.kids(child.i, 'det').length === 0) {
      const object: ClauseElement = {
        role: 'Od',
        span: { start: possessive.i, end: possessive.i + 1 },
        text: possessive.text,
        form: 'NP',
        formLabel: 'frase nominal (NP)',
        structure: [
          {
            role: 'núcleo',
            span: { start: possessive.i, end: possessive.i + 1 },
            text: possessive.text,
          },
        ],
      };
      const complement = element(ctx, child, 'Co', 'NP', [possessive.i]);
      return [object, complement];
    }
  }
  return [element(ctx, child, role)];
}

function element(
  ctx: Context,
  token: ParsedToken,
  role: ElementRole,
  forceForm?: PhraseForm,
  exclude: number[] = [],
): ClauseElement {
  const { parse } = ctx;
  const span = parse.span(token.i, exclude);
  const base: ClauseElement = { role, span, text: parse.text(span), form: 'other', formLabel: '' };

  if (!forceForm && CLAUSE_DEPS.has(token.dep) && (token.pos === 'VERB' || token.pos === 'AUX')) {
    const kind: ClauseKind = token.dep === 'advcl' ? 'adverbial' : 'nominal';
    const clause = analyzeClause(ctx, token.i, kind);
    return { ...base, form: 'clause', formLabel: clause.label, clause, ...notes(token, role) };
  }
  const form = forceForm ?? phraseForm(token);
  return {
    ...base,
    form,
    formLabel: FORM_LABELS[form],
    ...(form === 'NP' || form === 'PP' || form === 'AdjP' || form === 'AdvP'
      ? { structure: phraseStructure(ctx, token, form, exclude) }
      : {}),
    ...notes(token, role),
  };
}

function notes(token: ParsedToken, role: ElementRole): Pick<ClauseElement, 'note'> {
  if (token.dep === 'expl') return { note: 'Sujeto gramatical vacío («there» existencial).' };
  if (token.dep === 'attr' && role === 'S')
    return { note: 'Sujeto nocional: el sujeto "real" de la cláusula existencial.' };
  if (token.dep === 'agent') return { note: 'Agente de la pasiva (by + NP).' };
  if ((token.dep === 'dative' || token.dep === 'iobj') && role === 'A') {
    return {
      note: 'Paráfrasis preposicional del objeto indirecto (equivale a la construcción SVOO). Según el criterio de la cátedra se analiza como adverbial o como objeto indirecto preposicional.',
    };
  }
  return {};
}

const FORM_LABELS: Readonly<Record<PhraseForm, string>> = {
  NP: 'frase nominal (NP)',
  VP: 'frase verbal (VP)',
  AdjP: 'frase adjetiva (AdjP)',
  AdvP: 'frase adverbial (AdvP)',
  PP: 'frase preposicional (PP)',
  clause: 'cláusula',
  other: 'otra',
};

function phraseForm(token: ParsedToken): PhraseForm {
  if (token.tag === 'WRB') return 'AdvP';
  switch (token.pos) {
    case 'NOUN':
    case 'PROPN':
    case 'PRON':
    case 'NUM':
    case 'DET':
      return 'NP';
    case 'ADJ':
      return 'AdjP';
    case 'ADV':
      return 'AdvP';
    case 'ADP':
      return 'PP';
    default:
      return 'other';
  }
}

/** Estructura interna: NP = determinantes + premodificadores + núcleo + posmodificadores; PP = preposición + complemento. */
function phraseStructure(
  ctx: Context,
  head: ParsedToken,
  form: PhraseForm,
  exclude: number[],
): StructurePart[] {
  const { parse } = ctx;
  const parts: StructurePart[] = [];
  const part = (
    role: StructurePart['role'],
    token: ParsedToken,
    clause?: ClauseAnalysis,
  ): StructurePart => {
    const span = parse.span(token.i);
    return { role, span, text: parse.text(span), ...(clause ? { clause } : {}) };
  };
  let headEnd = head.i + 1;

  for (const child of parse.kids(head.i)) {
    if (exclude.includes(child.i) || child.dep === 'punct') continue;
    if (form === 'PP') {
      if (child.dep === 'pobj') parts.push(part('complemento preposicional', child));
      else if (child.dep === 'pcomp') {
        const clause =
          child.pos === 'VERB' || child.pos === 'AUX'
            ? analyzeClause(ctx, child.i, 'nominal')
            : undefined;
        parts.push(part('complemento preposicional', child, clause));
      } else if (child.i < head.i) parts.push(part('premodificador', child));
      continue;
    }
    if (child.dep === 'cc' || child.dep === 'conj') {
      // Núcleos coordinados ("bread and butter"): se extiende el núcleo.
      headEnd = Math.max(headEnd, parse.span(child.i).end);
      continue;
    }
    if (
      form === 'NP' &&
      ['det', 'predet', 'poss', 'nummod', 'quantmod'].includes(child.dep) &&
      child.i < head.i
    ) {
      parts.push(part('determinante', child));
    } else if (child.i < head.i) {
      parts.push(part('premodificador', child));
    } else {
      const clauseKind: ClauseKind | null =
        child.dep === 'relcl'
          ? 'relativa'
          : child.dep === 'acl'
            ? 'posmodificadora no finita'
            : null;
      const isClause = clauseKind && (child.pos === 'VERB' || child.pos === 'AUX');
      const clause = isClause ? analyzeClause(ctx, child.i, clauseKind) : undefined;
      if (clause && clauseKind === 'posmodificadora no finita' && clause.finiteness === 'finita') {
        clause.kind = 'nominal';
        clause.label = clause.label.replace('posmodificadora no finita', 'nominal apositiva');
      }
      parts.push(part('posmodificador', child, clause));
    }
  }
  const headText = parse.text({ start: head.i, end: headEnd });
  parts.push({
    role: form === 'PP' ? 'preposición' : 'núcleo',
    span: { start: head.i, end: headEnd },
    text: headText,
  });
  return parts.sort((a, b) => a.span.start - b.span.start);
}

function clausePattern(
  elements: ClauseElement[],
  lemma: string,
  verbPhrase: VerbPhraseAnalysis | undefined,
  existential: boolean,
): { pattern: string; note?: string } {
  if (!verbPhrase) return { pattern: '—', note: 'Cláusula sin verbo (verbless).' };
  const has = (role: ElementRole) => elements.some((e) => e.role === role);
  const verb = elements.find((e) => e.role === 'V');
  const afterVerb = (e: ClauseElement) => !verb || e.span.start > verb.span.start;
  const eligible = (e: ClauseElement) =>
    e.role === 'A' &&
    (e.form === 'PP' || e.form === 'AdvP' || e.form === 'NP') &&
    !OPTIONAL_ADVERBS.has(e.text.toLowerCase()) &&
    !e.note?.startsWith('Agente');
  const candidateA =
    elements.find((e) => eligible(e) && afterVerb(e)) ??
    elements.find(
      (e) =>
        eligible(e) &&
        !afterVerb(e) &&
        (e.form === 'PP' || /^(here|there|where|home|away)$/i.test(e.text)),
    );
  const notes: string[] = [];
  if (verbPhrase.passive) {
    // En la pasiva, el complemento del objeto de la activa pasa a ser complemento del sujeto.
    for (const e of elements) if (e.role === 'Co') e.role = 'Cs';
    notes.push(
      'Cláusula pasiva: el sujeto corresponde al objeto de la activa; el agente (by…) es opcional.',
    );
  }
  if (!has('S') && verbPhrase.imperative) notes.push('Imperativa: el sujeto (you) está implícito.');
  if (existential) {
    const underlying = candidateA ? 'SVA' : 'SV';
    if (candidateA) candidateA.obligatory = true;
    return {
      pattern: 'existencial',
      note: `There + be + sujeto nocional: equivale a la cláusula ${underlying} sin «there» (p. ej. «A cat is on the roof»).`,
    };
  }

  let pattern: string;
  if (has('Oi') && has('Od')) pattern = 'SVOO';
  else if (has('Od') && has('Co')) pattern = 'SVOC';
  else if (has('Od')) pattern = SVOA_VERBS.has(lemma) && candidateA ? 'SVOA' : 'SVO';
  else if (has('Cs')) pattern = 'SVC';
  else pattern = SVA_VERBS.has(lemma) && candidateA ? 'SVA' : 'SV';
  if ((pattern === 'SVA' || pattern === 'SVOA') && candidateA) candidateA.obligatory = true;
  for (const e of elements) if (e.role === 'A' && e.obligatory === undefined) e.obligatory = false;
  return { pattern, ...(notes.length ? { note: notes.join(' ') } : {}) };
}

function clauseLabel(
  kind: ClauseKind,
  finiteness: 'finita' | 'no finita',
  verbPhrase: VerbPhraseAnalysis | undefined,
  subordinator: string | undefined,
  relativeWord: string | undefined,
): string {
  if (kind === 'independiente') return 'cláusula independiente';
  if (kind === 'coordinada') return 'cláusula coordinada';
  const form = verbPhrase?.nonFiniteForm ? ` (${verbPhrase.nonFiniteForm})` : '';
  let label = `cláusula ${kind} ${finiteness}${form}`;
  if (subordinator) label += ` introducida por «${subordinator}»`;
  else if (relativeWord) label += ` (pronombre relativo «${relativeWord.toLowerCase()}»)`;
  return label;
}

// --- Grupo verbal ------------------------------------------------------------------------------

const FINITE_TAGS = new Set(['VBD', 'VBZ', 'VBP', 'MD']);

function analyzeVerbPhrase(parse: Parse, head: number): VerbPhraseAnalysis {
  const tokens = [
    head,
    ...parse
      .kids(head)
      .filter(inVerbGroup)
      .map((t) => t.i),
  ]
    .sort((a, b) => a - b)
    .map((i) => parse.tokens[i]);
  const verbs = tokens.filter((t) => t.dep !== 'neg' && t.dep !== 'prt' && t.tag !== 'TO');
  const headToken = parse.tokens[head];

  let modal: string | undefined;
  let perfect = false;
  let progressive = false;
  let passive = false;
  const parts: VerbPhraseAnalysis['parts'] = [];
  for (const t of tokens) {
    const next = verbs[verbs.indexOf(t) + 1];
    const lemma = t.lemma.toLowerCase();
    let role: VerbPartRole;
    if (t.i === head) role = t.dep === 'prt' ? 'partícula' : 'verbo léxico';
    else if (t.dep === 'neg') role = 'negación';
    else if (t.dep === 'prt') role = 'partícula';
    else if (t.tag === 'TO') role = 'marca de infinitivo';
    else if (t.tag === 'MD') {
      role = 'modal';
      modal = t.text.toLowerCase();
    } else if (t.dep === 'auxpass') {
      role = 'auxiliar de pasiva';
      passive = true;
    } else if (lemma === 'have' && next?.tag === 'VBN') {
      role = 'auxiliar de perfecto';
      perfect = true;
    } else if (lemma === 'be' && next?.tag === 'VBG') {
      role = 'auxiliar de progresivo';
      progressive = true;
    } else if (lemma === 'do') role = 'auxiliar do';
    else role = 'verbo léxico';
    parts.push({ text: t.text, role });
  }

  const first = verbs[0] ?? headToken;
  const subjects = parse.kids(head, 'nsubj', 'nsubjpass', 'expl', 'csubj');
  const hasSubject = subjects.length > 0;
  const imperative =
    headToken.dep === 'ROOT' &&
    !hasSubject &&
    tokens[0].tag !== 'TO' &&
    (first.i === head
      ? first.tag === 'VB'
      : first.lemma.toLowerCase() === 'do' && headToken.tag === 'VB');
  // Con inversión (preguntas, «Never have I seen…») el auxiliar antes del sujeto es finito
  // aunque spaCy lo etiquete como forma base.
  const inverted =
    hasSubject && first.i !== head && first.i < Math.min(...subjects.map((s) => s.i));
  const finite = imperative || FINITE_TAGS.has(first.tag) || inverted;
  const hasTo = tokens.some((t) => t.tag === 'TO');
  const nonFiniteForm: VerbPhraseAnalysis['nonFiniteForm'] | undefined = finite
    ? undefined
    : hasTo
      ? 'to-infinitive'
      : first.tag === 'VBG'
        ? '-ing participle'
        : first.tag === 'VBN'
          ? '-ed participle'
          : 'bare infinitive';
  const tense =
    finite && !modal && !imperative ? (first.tag === 'VBD' ? 'past' : 'present') : undefined;
  const negative = tokens.some((t) => t.dep === 'neg');

  const aspects = [...(perfect ? ['perfect'] : []), ...(progressive ? ['progressive'] : [])];
  const extras = [...aspects, ...(passive ? ['passive'] : [])];
  let label: string;
  if (imperative) label = 'imperative';
  else if (modal) label = `modal «${modal}»${extras.length ? ` + ${extras.join(' ')}` : ''}`;
  else if (finite)
    label = `${tense} ${aspects.length ? aspects.join(' ') : 'simple'}${passive ? ' passive' : ''}`;
  else label = `${nonFiniteForm}${extras.length ? ` (${extras.join(', ')})` : ''}`;
  if (negative) label += ', negative';

  const spanTokens = tokens.map((t) => t.i);
  const span = { start: Math.min(...spanTokens), end: Math.max(...spanTokens) + 1 };
  return {
    span,
    text: contiguous(spanTokens)
      .map((p) => parse.text(p))
      .join(' … '),
    parts,
    finite,
    ...(nonFiniteForm ? { nonFiniteForm } : {}),
    ...(tense ? { tense } : {}),
    ...(modal ? { modal } : {}),
    perfect,
    progressive,
    passive,
    negative,
    imperative,
    label,
    description: describeVerbPhrase({
      finite,
      nonFiniteForm,
      tense,
      modal,
      perfect,
      progressive,
      passive,
      negative,
      imperative,
    }),
  };
}

function describeVerbPhrase(v: {
  finite: boolean;
  nonFiniteForm?: string;
  tense?: string;
  modal?: string;
  perfect: boolean;
  progressive: boolean;
  passive: boolean;
  negative: boolean;
  imperative: boolean;
}): string {
  const parts: string[] = [];
  if (v.imperative) parts.push('Finito, modo imperativo');
  else if (v.finite) {
    parts.push(
      v.modal
        ? `Finito, con el modal «${v.modal}»`
        : `Finito, tiempo ${v.tense === 'past' ? 'pasado' : 'presente'}`,
    );
  } else parts.push(`No finito (${v.nonFiniteForm})`);
  const aspects = [v.perfect && 'perfecto', v.progressive && 'progresivo'].filter(Boolean);
  parts.push(aspects.length ? `aspecto ${aspects.join(' y ')}` : 'sin aspecto marcado');
  parts.push(v.passive ? 'voz pasiva' : 'voz activa');
  if (v.negative) parts.push('negativo');
  return `${parts.join(', ')}.`;
}

// --- Utilidades ---------------------------------------------------------------------------------

function contiguous(indexes: number[]): TokenSpan[] {
  const sorted = [...indexes].sort((a, b) => a - b);
  const pieces: TokenSpan[] = [];
  for (const i of sorted) {
    const last = pieces[pieces.length - 1];
    if (last && last.end === i) last.end = i + 1;
    else pieces.push({ start: i, end: i + 1 });
  }
  return pieces;
}

/** Clases de palabras según Quirk, en castellano (con el término en inglés). */
function toGrammarToken(t: ParsedToken): GrammarToken {
  return {
    text: t.text,
    ws: t.ws,
    lemma: t.lemma,
    pos: t.pos,
    tag: t.tag,
    wordClass: wordClass(t),
  };
}

function wordClass(t: ParsedToken): string {
  if (t.tag === 'PRP$' || t.tag === 'WP$') return 'determinante posesivo (determiner)';
  if (t.tag === 'PDT') return 'predeterminante (predeterminer)';
  if (t.tag === 'EX') return '«there» existencial';
  if (t.tag === 'RP') return 'partícula adverbial (verbo frasal)';
  if (t.tag === 'TO') return 'partícula «to» (infinitivo)';
  if (t.dep === 'neg') return 'negación (not)';
  switch (t.pos) {
    case 'NOUN':
      return 'sustantivo (noun)';
    case 'PROPN':
      return 'sustantivo propio (proper noun)';
    case 'PRON':
      return 'pronombre (pronoun)';
    case 'VERB':
      return 'verbo léxico (lexical verb)';
    case 'AUX':
      return t.tag === 'MD'
        ? 'auxiliar modal (modal auxiliary)'
        : t.dep === 'ROOT'
          ? 'verbo (be)'
          : 'auxiliar (primary auxiliary)';
    case 'ADJ':
      return 'adjetivo (adjective)';
    case 'ADV':
      return 'adverbio (adverb)';
    case 'DET':
      return 'determinante (determiner)';
    case 'ADP':
      return 'preposición (preposition)';
    case 'CCONJ':
      return 'conjunción coordinante (coordinator)';
    case 'SCONJ':
      return 'conjunción subordinante (subordinator)';
    case 'NUM':
      return 'numeral';
    case 'INTJ':
      return 'interjección (interjection)';
    case 'PUNCT':
      return 'puntuación';
    default:
      return 'otro';
  }
}
