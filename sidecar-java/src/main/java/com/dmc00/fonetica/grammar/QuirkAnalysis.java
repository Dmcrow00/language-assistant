package com.dmc00.fonetica.grammar;

import com.dmc00.fonetica.core.JsStrings;
import com.dmc00.fonetica.grammar.GrammarModel.GrammarAnalysis;
import com.dmc00.fonetica.grammar.GrammarModel.GrammarToken;
import com.dmc00.fonetica.grammar.GrammarModel.SentenceGrammar;
import com.dmc00.fonetica.grammar.GrammarModel.StructurePart;
import com.dmc00.fonetica.grammar.GrammarModel.TokenSpan;
import com.dmc00.fonetica.grammar.GrammarModel.VerbPart;
import com.dmc00.fonetica.grammar.GrammarModel.VerbPhraseAnalysis;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Interpretación del árbol de dependencias de spaCy en términos de Quirk / Greenbaum.
 *
 * <p>spaCy da, para cada palabra, su núcleo y la relación (nsubj, dobj, prep...). Acá se traduce:
 * <pre>
 *   nsubj → S · verbo + auxiliares → V · dobj → Od · dative → Oi · attr/acomp → Cs · oprd → Co
 *   prep/advmod/advcl/agent → A · ccomp/xcomp/csubj → cláusula nominal · advcl → adverbial · relcl → relativa
 * </pre>
 * y se corrigen algunos errores típicos del modelo en los patrones de manual (ver {@code fixElement}).
 */
public final class QuirkAnalysis {

    private static final Set<String> VERB_GROUP_DEPS = Set.of("aux", "auxpass", "neg", "prt");
    /** Palabras del adverbial de tiempo que spaCy a veces cuelga del adjetivo (open on Sundays). */
    private static final Set<String> TIME_WORDS = words(
            "monday tuesday wednesday thursday friday saturday sunday weekend morning afternoon evening "
                    + "night day week month year summer winter spring autumn holiday christmas time "
                    + "january february march april may june july august september october november december");
    private static final Set<String> SUBJECT_DEPS = Set.of("nsubj", "nsubjpass", "csubj", "csubjpass", "expl");
    private static final Set<String> ADVERBIAL_DEPS = Set.of(
            "prep", "advmod", "npadvmod", "advcl", "agent", "tmod", "obl", "nmod",
            // "never", "no longer"...: spaCy los marca como negación, pero para Quirk son adverbiales.
            "neg");
    private static final Set<String> CLAUSE_DEPS = Set.of("ccomp", "xcomp", "advcl", "csubj", "csubjpass", "relcl",
            "acl", "pcomp");
    private static final Set<String> IGNORED_DEPS = Set.of("punct", "mark", "cc", "conj", "intj", "parataxis", "dep",
            "meta", "discourse");

    /** Verbos copulativos: lo que sigue es complemento del sujeto (The soup tasted delicious). */
    private static final Set<String> LINKING_VERBS = words(
            "be seem appear become get grow turn look sound smell taste feel remain stay keep prove go come fall");
    /** Transitivos complejos con complemento del objeto (They elected her president). */
    private static final Set<String> OBJECT_COMPLEMENT_VERBS = words(
            "elect make appoint call name consider find keep leave paint declare crown vote think believe judge "
                    + "prove render drive turn colour color dye");
    /** Verbos que piden un adverbial obligatorio: SVA (be in the garden, live in Paris). */
    private static final Set<String> SVA_VERBS = words(
            "be live stay remain lie sit stand go come get last belong reside hang rest");
    /** Verbos que piden objeto + adverbial obligatorio: SVOA (put the dish on the table). */
    private static final Set<String> SVOA_VERBS = words(
            "put place set lay keep stand send take bring lead show treat hang stick get");
    /** Preposiciones de lugar: el adverbial obligatorio de put, place, keep... */
    private static final Set<String> LOCATIVE_PREPOSITIONS = words(
            "on in into onto under at behind near beside inside over above below between across");
    /** Adverbios que nunca son el adverbial obligatorio del patrón. */
    private static final Set<String> OPTIONAL_ADVERBS = words(
            "ever never always often sometimes usually also just already still even only really not");

    private static final Set<String> FINITE_TAGS = Set.of("VBD", "VBZ", "VBP", "MD");
    private static final Set<String> DETERMINER_DEPS = Set.of("det", "predet", "poss", "nummod", "quantmod");

    private static final Map<String, String> FORM_LABELS = Map.of(
            "NP", "frase nominal (NP)",
            "VP", "frase verbal (VP)",
            "AdjP", "frase adjetiva (AdjP)",
            "AdvP", "frase adverbial (AdvP)",
            "PP", "frase preposicional (PP)",
            "clause", "cláusula",
            "other", "otra");

    private static final Pattern NEGATION = Pattern.compile("^(not|n't|n’t)\\z", Pattern.CASE_INSENSITIVE);
    private static final Pattern RELATIVE_TAG = Pattern.compile("^(WDT|WP|WP\\$)\\z");
    private static final Pattern QUESTION_END = Pattern.compile("\\?" + JsStrings.SPACE + "*\\z");
    private static final Pattern EXCLAMATION_END = Pattern.compile("!" + JsStrings.SPACE + "*\\z");
    private static final Pattern EXCLAMATIVE_START = Pattern.compile("^(what|how)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern FRONTED_PLACE_WORD = Pattern.compile("^(here|there|where|home|away)\\z",
            Pattern.CASE_INSENSITIVE);

    private QuirkAnalysis() {
    }

    private static Set<String> words(String list) {
        return Set.of(list.split(" "));
    }

    /** "Sundays", "mornings"...: spaCy no siempre singulariza los nombres propios. */
    private static boolean isTimeWord(String word) {
        String w = JsStrings.lower(word);
        return TIME_WORDS.contains(w) || TIME_WORDS.contains(w.replaceFirst("s\\z", ""));
    }

    /** Auxiliares, partícula de verbo frasal y "not / n't": lo que forma la frase verbal con el verbo. */
    private static boolean inVerbGroup(ParsedToken token) {
        if (token.dep().equals("neg")) return NEGATION.matcher(token.text()).find();
        return VERB_GROUP_DEPS.contains(token.dep());
    }

    /** El árbol de dependencias con los hijos de cada token, en orden. */
    private static final class Parse {
        final List<ParsedToken> tokens;
        final List<List<Integer>> children = new ArrayList<>();

        Parse(List<ParsedToken> tokens) {
            this.tokens = tokens;
            for (int k = 0; k < tokens.size(); k++) children.add(new ArrayList<>());
            for (ParsedToken t : tokens) if (t.head() != t.i()) children.get(t.head()).add(t.i());
        }

        ParsedToken token(int i) {
            return tokens.get(i);
        }

        /** Los hijos de un token; si se pasan relaciones, sólo los que tienen alguna de ellas. */
        List<ParsedToken> kids(int i, String... deps) {
            List<String> wanted = List.of(deps);
            return children.get(i).stream()
                    .map(tokens::get)
                    .filter(c -> wanted.isEmpty() || wanted.contains(c.dep()))
                    .toList();
        }

        /**
         * El subárbol de un token, sin la puntuación de los bordes. Si se excluyen partes (la cláusula
         * coordinada que sigue), se toma el tramo continuo alrededor del núcleo.
         */
        TokenSpan span(int i, List<Integer> exclude) {
            Set<Integer> members = new HashSet<>(subtree(i, new HashSet<>(exclude)));
            int start = i;
            int end = i + 1;
            while (members.contains(start - 1)) start--;
            while (members.contains(end)) end++;
            while (start < end - 1 && tokens.get(start).pos().equals("PUNCT")) start++;
            while (end - 1 > start && tokens.get(end - 1).pos().equals("PUNCT")) end--;
            return new TokenSpan(start, end);
        }

        TokenSpan span(int i) {
            return span(i, List.of());
        }

        /** Recorrido en preorden: el token y después cada hijo con su subárbol. */
        List<Integer> subtree(int i, Set<Integer> exclude) {
            List<Integer> result = new ArrayList<>();
            result.add(i);
            for (int c : children.get(i)) if (!exclude.contains(c)) result.addAll(subtree(c, exclude));
            return result;
        }

        String text(TokenSpan span) {
            StringBuilder out = new StringBuilder();
            for (int k = span.start(); k < span.end(); k++) {
                ParsedToken t = tokens.get(k);
                out.append(t.text());
                if (k < span.end() - 1) out.append(t.ws());
            }
            return out.toString();
        }
    }

    /** Lo que se acumula mientras se analiza una oración. */
    private static final class Context {
        final Parse parse;
        int subordinates;
        final List<VerbPhraseAnalysis> verbPhrases = new ArrayList<>();

        Context(Parse parse) {
            this.parse = parse;
        }
    }

    public static GrammarAnalysis analyzeGrammar(List<ParsedToken> tokens) {
        Parse parse = new Parse(tokens);
        List<SentenceGrammar> sentences = new ArrayList<>();
        List<Integer> starts = tokens.stream().filter(t -> t.sentStart() || t.i() == 0).map(ParsedToken::i).toList();
        for (int k = 0; k < starts.size(); k++) {
            int start = starts.get(k);
            int end = k + 1 < starts.size() ? starts.get(k + 1) : tokens.size();
            ParsedToken root = tokens.subList(start, end).stream()
                    .filter(t -> t.dep().equals("ROOT"))
                    .findFirst()
                    .orElse(null);
            if (root != null) sentences.add(analyzeSentence(parse, root.i(), new TokenSpan(start, end)));
        }
        return new GrammarAnalysis(tokens.stream().map(QuirkAnalysis::toGrammarToken).toList(), sentences);
    }

    private static SentenceGrammar analyzeSentence(Parse parse, int root, TokenSpan span) {
        Context ctx = new Context(parse);
        List<ClauseAnalysis> clauses = new ArrayList<>();
        clauses.add(analyzeClause(ctx, root, "independiente", coordinatedTail(parse, root)));
        // Cláusulas coordinadas: verbos unidos al principal con "and", "but", "or"...
        int current = root;
        while (true) {
            ParsedToken next = firstVerb(parse.kids(current, "conj"));
            if (next == null) break;
            ClauseAnalysis clause = analyzeClause(ctx, next.i(), "coordinada", coordinatedTail(parse, next.i()));
            int from = clauses.getLast().getSpan().end();
            ParsedToken cc = from < next.i()
                    ? parse.tokens.subList(from, next.i()).stream().filter(t -> t.dep().equals("cc")).findFirst().orElse(null)
                    : null;
            if (cc != null) {
                clause.setCoordinator(JsStrings.lower(cc.text()));
                clause.setLabel("cláusula coordinada (" + clause.getCoordinator() + ")");
            }
            clauses.add(clause);
            current = next.i();
        }
        String text = parse.text(span);
        int independent = clauses.size();
        String structure = independent > 1
                ? ctx.subordinates > 0 ? "compuesta-compleja" : "compuesta"
                : ctx.subordinates > 0 ? "compleja" : "simple";
        VerbPhraseAnalysis firstVerbPhrase = clauses.getFirst().getVerbPhrase();
        String form = QUESTION_END.matcher(text).find()
                ? "interrogativa"
                : firstVerbPhrase != null && firstVerbPhrase.imperative()
                        ? "imperativa"
                        : EXCLAMATIVE_START.matcher(text).find() && EXCLAMATION_END.matcher(text).find()
                                ? "exclamativa"
                                : "declarativa";
        List<VerbPhraseAnalysis> verbPhrases = new ArrayList<>(ctx.verbPhrases);
        verbPhrases.sort(Comparator.comparingInt(v -> v.span().start()));
        return new SentenceGrammar(span, text, structure, form, clauses, verbPhrases, ctx.subordinates);
    }

    private static ParsedToken firstVerb(List<ParsedToken> candidates) {
        return candidates.stream()
                .filter(c -> c.pos().equals("VERB") || c.pos().equals("AUX"))
                .findFirst()
                .orElse(null);
    }

    /** Lo que hay que sacar del texto de una cláusula para no incluir a la coordinada que le sigue. */
    private static List<Integer> coordinatedTail(Parse parse, int head) {
        ParsedToken next = firstVerb(parse.kids(head, "conj"));
        if (next == null) return List.of();
        List<Integer> tail = new ArrayList<>();
        tail.add(next.i());
        for (ParsedToken c : parse.kids(head, "cc")) if (c.i() < next.i()) tail.add(c.i());
        return tail;
    }

    private static ClauseAnalysis analyzeClause(Context ctx, int head, String kind, List<Integer> excludeFromSpan) {
        Parse parse = ctx.parse;
        ParsedToken headToken = parse.token(head);
        if (!kind.equals("independiente") && !kind.equals("coordinada")) ctx.subordinates++;

        VerbPhraseAnalysis verbPhrase = headToken.pos().equals("VERB") || headToken.pos().equals("AUX")
                ? analyzeVerbPhrase(parse, head)
                : null;
        if (verbPhrase != null) ctx.verbPhrases.add(verbPhrase);

        List<ClauseElement> elements = new ArrayList<>();
        String subordinator = null;
        List<ParsedToken> marks = parse.kids(head, "mark");
        if (!marks.isEmpty()) subordinator = JsStrings.lower(marks.getFirst().text());

        List<Integer> verbTokens = new ArrayList<>();
        verbTokens.add(head);
        for (ParsedToken t : parse.kids(head)) if (inVerbGroup(t)) verbTokens.add(t.i());
        verbTokens.sort(Comparator.naturalOrder());
        if (verbPhrase != null) {
            List<TokenSpan> pieces = contiguous(verbTokens);
            elements.add(new ClauseElement(
                    "V",
                    new TokenSpan(verbTokens.getFirst(), verbTokens.getLast() + 1),
                    pieces.size() > 1 ? pieces : null,
                    String.join(" … ", pieces.stream().map(parse::text).toList()),
                    "VP",
                    "frase verbal (VP)",
                    null, null, null));
        }

        boolean hasExpletive = !parse.kids(head, "expl").isEmpty();
        boolean hasObject = !parse.kids(head, "dobj").isEmpty();
        String lemma = JsStrings.lower(headToken.lemma());

        for (ParsedToken child : parse.kids(head)) {
            if (inVerbGroup(child) || IGNORED_DEPS.contains(child.dep())) continue;
            // "When it rains": el adverbio wh- al comienzo de una adverbial es el subordinante, no un elemento.
            if (kind.equals("adverbial") && child.dep().equals("advmod") && child.tag().equals("WRB")
                    && child.i() < head && subordinator == null) {
                subordinator = JsStrings.lower(child.text());
                continue;
            }
            String role = roleOf(child, lemma, hasExpletive, hasObject, lemma.equals("be"));
            if (role == null) continue;
            elements.addAll(fixElement(ctx, child, role, lemma, hasObject));
        }

        elements.sort(Comparator.comparingInt(e -> e.getSpan().start()));
        fixInvertedSubject(elements, lemma, verbPhrase);
        ClausePattern pattern = clausePattern(elements, lemma, verbPhrase, hasExpletive);
        List<String> notes = new ArrayList<>();
        if (pattern.note() != null) notes.add(pattern.note());
        if (kind.equals("coordinada") && elements.stream().noneMatch(e -> e.getRole().equals("S"))
                && !(verbPhrase != null && verbPhrase.imperative())) {
            notes.add("Sujeto elíptico: es el mismo de la cláusula anterior.");
        }
        String finiteness = verbPhrase != null && !verbPhrase.finite() ? "no finita" : "finita";
        ParsedToken relative = kind.equals("relativa")
                ? parse.subtree(head, Set.of()).stream()
                        .map(parse::token)
                        .filter(t -> RELATIVE_TAG.matcher(t.tag()).find())
                        .findFirst()
                        .orElse(null)
                : null;

        TokenSpan span = parse.span(head, excludeFromSpan);
        return new ClauseAnalysis(
                kind,
                finiteness,
                clauseLabel(kind, finiteness, verbPhrase, subordinator, relative == null ? null : relative.text()),
                span,
                parse.text(span),
                subordinator,
                elements,
                pattern.pattern(),
                notes.isEmpty() ? null : String.join(" ", notes),
                verbPhrase);
    }

    /**
     * «In the corner stood an old piano»: con un adverbial de lugar adelantado el sujeto va después del verbo
     * y spaCy lo toma como objeto. Si la cláusula no tiene sujeto y el verbo es de los que piden un
     * adverbial de lugar (stand, lie, come...), ese "objeto" es el sujeto invertido.
     */
    private static void fixInvertedSubject(List<ClauseElement> elements, String lemma, VerbPhraseAnalysis verbPhrase) {
        if (verbPhrase == null || !verbPhrase.finite() || verbPhrase.imperative() || !SVA_VERBS.contains(lemma)) return;
        if (elements.stream().anyMatch(e -> e.getRole().equals("S"))) return;
        int verbStart = elements.stream()
                .filter(e -> e.getRole().equals("V"))
                .findFirst()
                .map(e -> e.getSpan().start())
                .orElse(0);
        boolean fronted = elements.stream().anyMatch(e -> e.getRole().equals("A") && e.getSpan().start() < verbStart
                && (e.getForm().equals("PP") || e.getForm().equals("AdvP")));
        ClauseElement object = elements.stream()
                .filter(e -> e.getRole().equals("Od") && e.getSpan().start() > verbStart)
                .findFirst()
                .orElse(null);
        if (fronted && object != null) {
            object.setRole("S");
            object.setNote("Sujeto invertido: va después del verbo porque el adverbial de lugar está adelante.");
        }
    }

    private static String roleOf(ParsedToken child, String verbLemma, boolean hasExpletive, boolean hasObject,
                                 boolean isCopula) {
        if (SUBJECT_DEPS.contains(child.dep())) return "S";
        switch (child.dep()) {
            case "dobj" -> {
                return "Od";
            }
            case "dative", "iobj" -> {
                return child.pos().equals("ADP") ? "A" : "Oi";
            }
            case "attr" -> {
                return hasExpletive ? "S" : "Cs";
            }
            case "acomp" -> {
                return hasObject ? "Co" : "Cs";
            }
            case "oprd" -> {
                return "Co";
            }
            case "ccomp" -> {
                return isCopula ? "Cs" : "Od";
            }
            case "xcomp" -> {
                return LINKING_VERBS.contains(verbLemma) && !verbLemma.equals("get") ? "Cs" : hasObject ? "Co" : "Od";
            }
            default -> {
                return ADVERBIAL_DEPS.contains(child.dep()) ? "A" : null;
            }
        }
    }

    /**
     * Arma el elemento y corrige los errores frecuentes del modelo chico de spaCy:
     * <ul>
     *   <li>«The soup tasted delicious»: toma el adjetivo como objeto → complemento del sujeto.</li>
     *   <li>«They painted the walls white»: toma el adjetivo como adverbial → complemento del objeto.</li>
     *   <li>«They elected her president»: une "her president" como posesivo → Od «her» + Co «president».</li>
     * </ul>
     */
    private static List<ClauseElement> fixElement(Context ctx, ParsedToken child, String role, String verbLemma,
                                                  boolean hasObject) {
        Parse parse = ctx.parse;
        boolean lowercase = child.text().equals(JsStrings.lower(child.text()));
        boolean bare = parse.kids(child.i(), "det", "poss", "predet", "nummod").isEmpty();

        // «The news made everyone happy», «I find this book boring»: spaCy arma una "minicláusula"
        // (el adjetivo como núcleo y el objeto como su sujeto). Quirk: Od + Co.
        if ((child.dep().equals("ccomp") || child.dep().equals("xcomp")) && OBJECT_COMPLEMENT_VERBS.contains(verbLemma)
                && (child.pos().equals("ADJ") || child.pos().equals("NOUN"))) {
            ParsedToken object = parse.kids(child.i(), "nsubj").stream()
                    .filter(s -> s.i() < child.i())
                    .findFirst()
                    .orElse(null);
            if (object != null && parse.kids(child.i(), "aux", "mark").isEmpty()) {
                return List.of(element(ctx, object, "Od"),
                        element(ctx, child, "Co", phraseForm(child), List.of(object.i())));
            }
        }
        // «They named their daughter Lucy»: el complemento del objeto llega como aposición.
        if (role.equals("Od") && OBJECT_COMPLEMENT_VERBS.contains(verbLemma)) {
            ParsedToken complement = parse.kids(child.i(), "appos").stream()
                    .filter(a -> a.i() > child.i())
                    .findFirst()
                    .orElse(null);
            if (complement != null) {
                return List.of(element(ctx, child, "Od", null, List.of(complement.i())), element(ctx, complement, "Co"));
            }
        }
        // «She placed the vase on the table»: el lugar obligatorio llega colgado del objeto.
        if (role.equals("Od") && SVOA_VERBS.contains(verbLemma) && parse.kids(child.head(), "prep").isEmpty()) {
            ParsedToken place = parse.kids(child.i(), "prep").stream()
                    .filter(p -> p.i() > child.i() && LOCATIVE_PREPOSITIONS.contains(JsStrings.lower(p.text())))
                    .findFirst()
                    .orElse(null);
            if (place != null) {
                return List.of(element(ctx, child, "Od", null, List.of(place.i())), element(ctx, place, "A"));
            }
        }

        if (role.equals("Od") && LINKING_VERBS.contains(verbLemma) && !verbLemma.equals("be") && bare && lowercase
                && (child.tag().equals("JJ") || child.tag().equals("NNP"))) {
            return List.of(element(ctx, child, "Cs", "AdjP", List.of()));
        }
        if ((role.equals("A") || role.equals("Cs")) && hasObject && child.pos().equals("ADJ")
                && parse.kids(child.i(), "nsubj", "aux", "mark").isEmpty()) {
            return List.of(element(ctx, child, "Co", "AdjP", List.of()));
        }
        // «Is the museum open on Sundays?»: spaCy cuelga el adverbial de tiempo del adjetivo.
        if ((role.equals("Cs") || role.equals("Co")) && child.pos().equals("ADJ")) {
            ParsedToken time = parse.kids(child.i(), "prep").stream()
                    .filter(p -> p.i() > child.i())
                    .filter(p -> parse.kids(p.i(), "pobj").stream().anyMatch(o -> isTimeWord(o.text())))
                    .findFirst()
                    .orElse(null);
            if (time != null) {
                return List.of(element(ctx, child, role, "AdjP", List.of(time.i())), element(ctx, time, "A"));
            }
        }
        // «There is a cat on the roof»: spaCy cuelga el lugar del sujeto nocional; Quirk lo analiza como adverbial.
        if (role.equals("S") && child.dep().equals("attr")) {
            List<ParsedToken> places = parse.kids(child.i(), "prep").stream().filter(p -> p.i() > child.i()).toList();
            if (!places.isEmpty()) {
                ParsedToken place = places.getLast();
                return List.of(element(ctx, child, "S", null, List.of(place.i())), element(ctx, place, "A"));
            }
        }
        if (role.equals("Od") && OBJECT_COMPLEMENT_VERBS.contains(verbLemma) && child.pos().equals("NOUN")) {
            ParsedToken possessive = parse.kids(child.i(), "poss").stream()
                    .filter(p -> JsStrings.lower(p.text()).equals("her") && p.i() < child.i())
                    .findFirst()
                    .orElse(null);
            if (possessive != null && parse.kids(child.i(), "det").isEmpty()) {
                TokenSpan herSpan = new TokenSpan(possessive.i(), possessive.i() + 1);
                ClauseElement object = new ClauseElement("Od", herSpan, null, possessive.text(), "NP",
                        "frase nominal (NP)", null,
                        List.of(new StructurePart("núcleo", herSpan, possessive.text(), null)), null);
                ClauseElement complement = element(ctx, child, "Co", "NP", List.of(possessive.i()));
                return List.of(object, complement);
            }
        }
        return List.of(element(ctx, child, role));
    }

    private static ClauseElement element(Context ctx, ParsedToken token, String role) {
        return element(ctx, token, role, null, List.of());
    }

    /**
     * @param forceForm la forma de la frase si se sabe de antemano; null = la que corresponde al token
     * @param exclude   tokens que no forman parte del elemento (el complemento que se separó)
     */
    private static ClauseElement element(Context ctx, ParsedToken token, String role, String forceForm,
                                         List<Integer> exclude) {
        Parse parse = ctx.parse;
        TokenSpan span = parse.span(token.i(), exclude);
        String text = parse.text(span);

        if (forceForm == null && CLAUSE_DEPS.contains(token.dep())
                && (token.pos().equals("VERB") || token.pos().equals("AUX"))) {
            String kind = token.dep().equals("advcl") ? "adverbial" : "nominal";
            ClauseAnalysis clause = analyzeClause(ctx, token.i(), kind, List.of());
            return new ClauseElement(role, span, null, text, "clause", clause.getLabel(), noteOf(token, role), null,
                    clause);
        }
        String form = forceForm != null ? forceForm : phraseForm(token);
        boolean hasStructure = form.equals("NP") || form.equals("PP") || form.equals("AdjP") || form.equals("AdvP");
        return new ClauseElement(role, span, null, text, form, FORM_LABELS.get(form), noteOf(token, role),
                hasStructure ? phraseStructure(ctx, token, form, exclude) : null, null);
    }

    private static String noteOf(ParsedToken token, String role) {
        if (token.dep().equals("expl")) return "Sujeto gramatical vacío («there» existencial).";
        if (token.dep().equals("attr") && role.equals("S")) {
            return "Sujeto nocional: el sujeto \"real\" de la cláusula existencial.";
        }
        if (token.dep().equals("agent")) return "Agente de la pasiva (by + NP).";
        if ((token.dep().equals("dative") || token.dep().equals("iobj")) && role.equals("A")) {
            return "Paráfrasis preposicional del objeto indirecto (equivale a la construcción SVOO). Según el "
                    + "criterio de la cátedra se analiza como adverbial o como objeto indirecto preposicional.";
        }
        return null;
    }

    private static String phraseForm(ParsedToken token) {
        if (token.tag().equals("WRB")) return "AdvP";
        return switch (token.pos()) {
            case "NOUN", "PROPN", "PRON", "NUM", "DET" -> "NP";
            case "ADJ" -> "AdjP";
            case "ADV" -> "AdvP";
            case "ADP" -> "PP";
            default -> "other";
        };
    }

    /** Estructura interna: NP = determinantes + premodificadores + núcleo + posmodificadores; PP = preposición + complemento. */
    private static List<StructurePart> phraseStructure(Context ctx, ParsedToken head, String form,
                                                       List<Integer> exclude) {
        Parse parse = ctx.parse;
        List<StructurePart> parts = new ArrayList<>();
        int headEnd = head.i() + 1;

        for (ParsedToken child : parse.kids(head.i())) {
            if (exclude.contains(child.i()) || child.dep().equals("punct")) continue;
            if (form.equals("PP")) {
                if (child.dep().equals("pobj")) {
                    parts.add(part(parse, "complemento preposicional", child, null));
                } else if (child.dep().equals("pcomp")) {
                    ClauseAnalysis clause = child.pos().equals("VERB") || child.pos().equals("AUX")
                            ? analyzeClause(ctx, child.i(), "nominal", List.of())
                            : null;
                    parts.add(part(parse, "complemento preposicional", child, clause));
                } else if (child.i() < head.i()) {
                    parts.add(part(parse, "premodificador", child, null));
                }
                continue;
            }
            if (child.dep().equals("cc") || child.dep().equals("conj")) {
                // Núcleos coordinados ("bread and butter"): se extiende el núcleo.
                headEnd = Math.max(headEnd, parse.span(child.i()).end());
                continue;
            }
            if (form.equals("NP") && DETERMINER_DEPS.contains(child.dep()) && child.i() < head.i()) {
                parts.add(part(parse, "determinante", child, null));
            } else if (child.i() < head.i()) {
                parts.add(part(parse, "premodificador", child, null));
            } else {
                String clauseKind = child.dep().equals("relcl")
                        ? "relativa"
                        : child.dep().equals("acl") ? "posmodificadora no finita" : null;
                boolean isClause = clauseKind != null && (child.pos().equals("VERB") || child.pos().equals("AUX"));
                ClauseAnalysis clause = isClause ? analyzeClause(ctx, child.i(), clauseKind, List.of()) : null;
                if (clause != null && clauseKind.equals("posmodificadora no finita")
                        && clause.getFiniteness().equals("finita")) {
                    clause.setKind("nominal");
                    clause.setLabel(JsStrings.replaceFirstLiteral(clause.getLabel(), "posmodificadora no finita",
                            "nominal apositiva"));
                }
                parts.add(part(parse, "posmodificador", child, clause));
            }
        }
        TokenSpan headSpan = new TokenSpan(head.i(), headEnd);
        parts.add(new StructurePart(form.equals("PP") ? "preposición" : "núcleo", headSpan, parse.text(headSpan), null));
        parts.sort(Comparator.comparingInt(p -> p.span().start()));
        return parts;
    }

    private static StructurePart part(Parse parse, String role, ParsedToken token, ClauseAnalysis clause) {
        TokenSpan span = parse.span(token.i());
        return new StructurePart(role, span, parse.text(span), clause);
    }

    /** El patrón de la cláusula y, si corresponde, una aclaración (o null). */
    private record ClausePattern(String pattern, String note) {
    }

    private static ClausePattern clausePattern(List<ClauseElement> elements, String lemma, VerbPhraseAnalysis verbPhrase,
                                          boolean existential) {
        if (verbPhrase == null) return new ClausePattern("—", "Cláusula sin verbo (verbless).");
        ClauseElement verb = elements.stream().filter(e -> e.getRole().equals("V")).findFirst().orElse(null);
        ClauseElement candidateA = elements.stream()
                .filter(e -> eligibleAdverbial(e) && afterVerb(e, verb))
                .findFirst()
                .orElseGet(() -> elements.stream()
                        .filter(e -> eligibleAdverbial(e) && !afterVerb(e, verb)
                                && (e.getForm().equals("PP") || FRONTED_PLACE_WORD.matcher(e.getText()).find()))
                        .findFirst()
                        .orElse(null));
        List<String> notes = new ArrayList<>();
        if (verbPhrase.passive()) {
            // En la pasiva, el complemento del objeto de la activa pasa a ser complemento del sujeto.
            for (ClauseElement e : elements) if (e.getRole().equals("Co")) e.setRole("Cs");
            notes.add("Cláusula pasiva: el sujeto corresponde al objeto de la activa; el agente (by…) es opcional.");
        }
        if (!has(elements, "S") && verbPhrase.imperative()) notes.add("Imperativa: el sujeto (you) está implícito.");
        if (existential) {
            String underlying = candidateA != null ? "SVA" : "SV";
            if (candidateA != null) candidateA.setObligatory(true);
            return new ClausePattern("existencial", "There + be + sujeto nocional: equivale a la cláusula "
                    + underlying + " sin «there» (p. ej. «A cat is on the roof»).");
        }

        String pattern;
        if (has(elements, "Oi") && has(elements, "Od")) pattern = "SVOO";
        else if (has(elements, "Od") && has(elements, "Co")) pattern = "SVOC";
        else if (has(elements, "Od")) pattern = SVOA_VERBS.contains(lemma) && candidateA != null ? "SVOA" : "SVO";
        else if (has(elements, "Cs")) pattern = "SVC";
        else pattern = SVA_VERBS.contains(lemma) && candidateA != null ? "SVA" : "SV";
        if ((pattern.equals("SVA") || pattern.equals("SVOA")) && candidateA != null) candidateA.setObligatory(true);
        for (ClauseElement e : elements) if (e.getRole().equals("A") && e.getObligatory() == null) e.setObligatory(false);
        return new ClausePattern(pattern, notes.isEmpty() ? null : String.join(" ", notes));
    }

    private static boolean has(List<ClauseElement> elements, String role) {
        return elements.stream().anyMatch(e -> e.getRole().equals(role));
    }

    private static boolean afterVerb(ClauseElement e, ClauseElement verb) {
        return verb == null || e.getSpan().start() > verb.getSpan().start();
    }

    private static boolean eligibleAdverbial(ClauseElement e) {
        return e.getRole().equals("A")
                && (e.getForm().equals("PP") || e.getForm().equals("AdvP") || e.getForm().equals("NP"))
                && !OPTIONAL_ADVERBS.contains(JsStrings.lower(e.getText()))
                && !(e.getNote() != null && e.getNote().startsWith("Agente"));
    }

    private static String clauseLabel(String kind, String finiteness, VerbPhraseAnalysis verbPhrase,
                                      String subordinator, String relativeWord) {
        if (kind.equals("independiente")) return "cláusula independiente";
        if (kind.equals("coordinada")) return "cláusula coordinada";
        String form = verbPhrase != null && JsStrings.truthy(verbPhrase.nonFiniteForm())
                ? " (" + verbPhrase.nonFiniteForm() + ")"
                : "";
        String label = "cláusula " + kind + " " + finiteness + form;
        if (JsStrings.truthy(subordinator)) label += " introducida por «" + subordinator + "»";
        else if (JsStrings.truthy(relativeWord)) label += " (pronombre relativo «" + JsStrings.lower(relativeWord) + "»)";
        return label;
    }

    // --- Grupo verbal ------------------------------------------------------------------------------

    private static VerbPhraseAnalysis analyzeVerbPhrase(Parse parse, int head) {
        List<Integer> indexes = new ArrayList<>();
        indexes.add(head);
        for (ParsedToken t : parse.kids(head)) if (inVerbGroup(t)) indexes.add(t.i());
        indexes.sort(Comparator.naturalOrder());
        List<ParsedToken> tokens = indexes.stream().map(parse::token).toList();
        List<ParsedToken> verbs = tokens.stream()
                .filter(t -> !t.dep().equals("neg") && !t.dep().equals("prt") && !t.tag().equals("TO"))
                .toList();
        ParsedToken headToken = parse.token(head);

        String modal = null;
        boolean perfect = false;
        boolean progressive = false;
        boolean passive = false;
        List<VerbPart> parts = new ArrayList<>();
        for (ParsedToken t : tokens) {
            // Como en la versión original: si el token no es un verbo, indexOf da -1 y "next" es el primer verbo.
            int nextIndex = verbs.indexOf(t) + 1;
            ParsedToken next = nextIndex < verbs.size() ? verbs.get(nextIndex) : null;
            String lemma = JsStrings.lower(t.lemma());
            String role;
            if (t.i() == head) {
                role = t.dep().equals("prt") ? "partícula" : "verbo léxico";
            } else if (t.dep().equals("neg")) {
                role = "negación";
            } else if (t.dep().equals("prt")) {
                role = "partícula";
            } else if (t.tag().equals("TO")) {
                role = "marca de infinitivo";
            } else if (t.tag().equals("MD")) {
                role = "modal";
                modal = JsStrings.lower(t.text());
            } else if (t.dep().equals("auxpass")) {
                role = "auxiliar de pasiva";
                passive = true;
            } else if (lemma.equals("have") && next != null && next.tag().equals("VBN")) {
                role = "auxiliar de perfecto";
                perfect = true;
            } else if (lemma.equals("be") && next != null && next.tag().equals("VBG")) {
                role = "auxiliar de progresivo";
                progressive = true;
            } else if (lemma.equals("do")) {
                role = "auxiliar do";
            } else {
                role = "verbo léxico";
            }
            parts.add(new VerbPart(t.text(), role));
        }

        ParsedToken first = verbs.isEmpty() ? headToken : verbs.getFirst();
        List<ParsedToken> subjects = parse.kids(head, "nsubj", "nsubjpass", "expl", "csubj");
        boolean hasSubject = !subjects.isEmpty();
        boolean imperative = headToken.dep().equals("ROOT")
                && !hasSubject
                && !tokens.getFirst().tag().equals("TO")
                && (first.i() == head
                        ? first.tag().equals("VB")
                        : JsStrings.lower(first.lemma()).equals("do") && headToken.tag().equals("VB"));
        // Con inversión (preguntas, «Never have I seen…») el auxiliar antes del sujeto es finito aunque
        // spaCy lo etiquete como forma base.
        boolean inverted = hasSubject && first.i() != head
                && first.i() < subjects.stream().mapToInt(ParsedToken::i).min().orElseThrow();
        boolean finite = imperative || FINITE_TAGS.contains(first.tag()) || inverted;
        boolean hasTo = tokens.stream().anyMatch(t -> t.tag().equals("TO"));
        String nonFiniteForm = finite
                ? null
                : hasTo ? "to-infinitive"
                        : first.tag().equals("VBG") ? "-ing participle"
                                : first.tag().equals("VBN") ? "-ed participle" : "bare infinitive";
        String tense = finite && modal == null && !imperative ? (first.tag().equals("VBD") ? "past" : "present") : null;
        boolean negative = tokens.stream().anyMatch(t -> t.dep().equals("neg"));

        List<String> aspects = new ArrayList<>();
        if (perfect) aspects.add("perfect");
        if (progressive) aspects.add("progressive");
        List<String> extras = new ArrayList<>(aspects);
        if (passive) extras.add("passive");
        String label;
        if (imperative) {
            label = "imperative";
        } else if (modal != null) {
            label = "modal «" + modal + "»" + (extras.isEmpty() ? "" : " + " + String.join(" ", extras));
        } else if (finite) {
            label = tense + " " + (aspects.isEmpty() ? "simple" : String.join(" ", aspects)) + (passive ? " passive" : "");
        } else {
            label = nonFiniteForm + (extras.isEmpty() ? "" : " (" + String.join(", ", extras) + ")");
        }
        if (negative) label += ", negative";

        TokenSpan span = new TokenSpan(indexes.getFirst(), indexes.getLast() + 1);
        return new VerbPhraseAnalysis(
                span,
                String.join(" … ", contiguous(indexes).stream().map(parse::text).toList()),
                parts,
                finite,
                nonFiniteForm,
                tense,
                modal,
                perfect,
                progressive,
                passive,
                negative,
                imperative,
                label,
                describeVerbPhrase(finite, nonFiniteForm, tense, modal, perfect, progressive, passive, negative,
                        imperative));
    }

    private static String describeVerbPhrase(boolean finite, String nonFiniteForm, String tense, String modal,
                                             boolean perfect, boolean progressive, boolean passive, boolean negative,
                                             boolean imperative) {
        List<String> parts = new ArrayList<>();
        if (imperative) {
            parts.add("Finito, modo imperativo");
        } else if (finite) {
            parts.add(modal != null
                    ? "Finito, con el modal «" + modal + "»"
                    : "Finito, tiempo " + ("past".equals(tense) ? "pasado" : "presente"));
        } else {
            parts.add("No finito (" + nonFiniteForm + ")");
        }
        List<String> aspects = new ArrayList<>();
        if (perfect) aspects.add("perfecto");
        if (progressive) aspects.add("progresivo");
        parts.add(aspects.isEmpty() ? "sin aspecto marcado" : "aspecto " + String.join(" y ", aspects));
        parts.add(passive ? "voz pasiva" : "voz activa");
        if (negative) parts.add("negativo");
        return String.join(", ", parts) + ".";
    }

    // --- Utilidades ---------------------------------------------------------------------------------

    /** Índices → tramos continuos: [2, 3, 5] → [2, 4) y [5, 6). */
    private static List<TokenSpan> contiguous(List<Integer> indexes) {
        List<Integer> sorted = new ArrayList<>(indexes);
        sorted.sort(Comparator.naturalOrder());
        List<TokenSpan> pieces = new ArrayList<>();
        for (int i : sorted) {
            TokenSpan last = pieces.isEmpty() ? null : pieces.getLast();
            if (last != null && last.end() == i) pieces.set(pieces.size() - 1, new TokenSpan(last.start(), i + 1));
            else pieces.add(new TokenSpan(i, i + 1));
        }
        return pieces;
    }

    private static GrammarToken toGrammarToken(ParsedToken t) {
        return new GrammarToken(t.text(), t.ws(), t.lemma(), t.pos(), t.tag(), wordClass(t));
    }

    /** Clases de palabras según Quirk, en castellano (con el término en inglés). */
    private static String wordClass(ParsedToken t) {
        if (t.tag().equals("PRP$") || t.tag().equals("WP$")) return "determinante posesivo (determiner)";
        if (t.tag().equals("PDT")) return "predeterminante (predeterminer)";
        if (t.tag().equals("EX")) return "«there» existencial";
        if (t.tag().equals("RP")) return "partícula adverbial (verbo frasal)";
        if (t.tag().equals("TO")) return "partícula «to» (infinitivo)";
        if (t.dep().equals("neg")) return "negación (not)";
        return switch (t.pos()) {
            case "NOUN" -> "sustantivo (noun)";
            case "PROPN" -> "sustantivo propio (proper noun)";
            case "PRON" -> "pronombre (pronoun)";
            case "VERB" -> "verbo léxico (lexical verb)";
            case "AUX" -> t.tag().equals("MD")
                    ? "auxiliar modal (modal auxiliary)"
                    : t.dep().equals("ROOT") ? "verbo (be)" : "auxiliar (primary auxiliary)";
            case "ADJ" -> "adjetivo (adjective)";
            case "ADV" -> "adverbio (adverb)";
            case "DET" -> "determinante (determiner)";
            case "ADP" -> "preposición (preposition)";
            case "CCONJ" -> "conjunción coordinante (coordinator)";
            case "SCONJ" -> "conjunción subordinante (subordinator)";
            case "NUM" -> "numeral";
            case "INTJ" -> "interjección (interjection)";
            case "PUNCT" -> "puntuación";
            default -> "otro";
        };
    }
}
