package com.dmc00.fonetica.core;

import com.dmc00.fonetica.api.LexiconInfo;
import com.dmc00.fonetica.api.PhonemeMatch;
import com.dmc00.fonetica.api.Prons;
import com.dmc00.fonetica.api.SpellingHit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Índice local de palabras con su pronunciación. Arranca con Britfone (diccionario abierto británico,
 * ~16 000 palabras) y cada palabra que se consulta en Longman reemplaza su transcripción por la de
 * Longman. La búsqueda por fonemas necesita este índice local: Longman sólo permite buscar por
 * ortografía.
 *
 * <p>Los métodos son {@code synchronized}: las consultas a Longman actualizan el índice mientras otro
 * pedido puede estar buscando.
 */
public class Lexicon {

    /** Penalidad por marcar el acento principal en otra vocal (sólo si el alumno lo pide). */
    private static final double STRESS_PENALTY = 0.5;

    private static final Pattern LINE_BREAK = Pattern.compile("\\r?\\n");
    private static final Pattern ALTERNATIVE_NUMBER = Pattern.compile("\\(\\d+\\)\\z");
    private static final Pattern QUOTES = Pattern.compile("[’‘`]");

    private record Pron(String display, List<PronVariant> variants) {
    }

    /** @param sound {@link #soundKey} de la clave, precalculada porque se compara en cada tecla */
    private record Entry(String key, String sound, String word, String source, List<Pron> prons) {
    }

    private record Candidate(Entry entry, Pron pron, PronVariant variant, double distance, boolean stressMismatch) {
    }

    private final Map<String, Entry> entries = new LinkedHashMap<>();

    public synchronized int size() {
        return entries.size();
    }

    public synchronized LexiconInfo info() {
        int fromLdoce = (int) entries.values().stream().filter(e -> e.source().equals("ldoce")).count();
        return new LexiconInfo(entries.size(), fromLdoce);
    }

    /** Formato Britfone: "WORD, f o n e m a s" o "WORD(2), ..." para pronunciaciones alternativas. */
    public synchronized void loadBritfone(String csv) {
        for (String line : LINE_BREAK.split(csv, -1)) {
            int comma = line.indexOf(',');
            if (comma <= 0) continue;
            String rawWord = JsStrings.trim(ALTERNATIVE_NUMBER.matcher(line.substring(0, comma)).replaceFirst("")
                    .replace("_", " "));
            String phonemes = JsStrings.trim(line.substring(comma + 1));
            if (rawWord.isEmpty() || phonemes.isEmpty()) continue;
            String word = rawWord.equals("I") ? "I" : JsStrings.lower(rawWord);
            String key = normalizeKey(word);
            Entry existing = entries.get(key);
            if (existing != null && existing.source().equals("ldoce")) continue;
            String display = Transcription.britfoneToLongman(phonemes);
            Pron pron = toPron(display, Ipa.toVariant(Ipa.tokenize(display).tokens()));
            if (existing != null) {
                if (existing.prons().stream().noneMatch(p -> p.display().equals(display))) existing.prons().add(pron);
            } else {
                List<Pron> prons = new ArrayList<>();
                prons.add(pron);
                entries.put(key, new Entry(key, soundKey(key), word, "britfone", prons));
            }
        }
    }

    /** Reemplaza (o agrega) la palabra con las transcripciones de Longman, que tienen prioridad. */
    public synchronized void upsertFromLdoce(String headword, List<String> prons) {
        List<Pron> parsed = new ArrayList<>();
        for (String display : new LinkedHashSet<>(prons)) {
            Pron pron = new Pron(display, Transcription.parseLongmanPron(display));
            if (!pron.variants().isEmpty()) parsed.add(pron);
        }
        if (parsed.isEmpty()) return;
        String key = normalizeKey(headword);
        // Map.put conserva la posición de una clave que ya estaba, igual que Map.set en JavaScript.
        entries.put(key, new Entry(key, soundKey(key), headword, "ldoce", parsed));
    }

    /** Pronunciaciones conocidas de una palabra (para mostrar algo si Longman no responde); null si no está. */
    public synchronized Prons pronsOf(String word) {
        Entry entry = entries.get(normalizeKey(word));
        return entry == null ? null : new Prons(entry.prons().stream().map(Pron::display).toList(), entry.source());
    }

    public synchronized List<SpellingHit> searchSpelling(String query, int limit) {
        String q = normalizeKey(query);
        if (q.isEmpty()) return List.of();
        int maxEdits = q.length() <= 3 ? 1 : q.length() <= 7 ? 2 : 3;
        String qSound = soundKey(q);
        List<SpellingHit> hits = new ArrayList<>();

        for (Entry entry : entries.values()) {
            String key = entry.key();
            String kind = null;
            double score = Double.POSITIVE_INFINITY;
            if (key.equals(q)) {
                kind = "exact";
                score = 0;
            } else if (key.startsWith(q)) {
                kind = "prefix";
                score = 0.5 + Math.min(0.9, 0.05 * (key.length() - q.length()));
            } else {
                int edits = Distance.osaDistance(q, key, maxEdits);
                if (edits <= maxEdits) {
                    kind = "fuzzy";
                    score = edits;
                }
                // Errores "por cómo suena" (fonetik → phonetic) que la distancia de letras no alcanza.
                if (qSound.length() >= 3) {
                    int allowed = qSound.length() >= 5 ? 1 : 0;
                    int soundEdits = Distance.osaDistance(qSound, entry.sound(), allowed);
                    if (soundEdits <= allowed) {
                        // Clave idéntica: entre las de 1 y 2 letras cambiadas; con una diferencia, después de todas.
                        double soundScore = 1.3 + soundEdits + 0.05 * Math.abs(key.length() - q.length());
                        if (soundScore < score) {
                            kind = "fuzzy";
                            score = soundScore;
                        }
                    }
                }
            }
            if (kind != null) {
                hits.add(new SpellingHit(entry.word(), entry.prons().stream().map(Pron::display).toList(),
                        entry.source(), kind, score));
            }
        }

        // A igual distancia gana el largo más parecido al tipeado: "watre" → water (letras invertidas) antes que ware.
        Comparator<SpellingHit> order = Comparator
                .comparingDouble(SpellingHit::score)
                .thenComparingInt(h -> Math.abs(h.word().length() - q.length()))
                .thenComparingInt(h -> h.word().length())
                .thenComparing(SpellingHit::word, JsStrings.LOCALE_ORDER);
        return hits.stream().sorted(order).limit(limit).toList();
    }

    public synchronized List<PhonemeMatch> searchPhonemes(List<String> written, boolean useStressOption, int limit) {
        PronVariant input = Ipa.toVariant(written);
        int n = input.segments().size();
        if (n == 0) return List.of();
        double maxDistance = Math.max(1.5, 0.6 * n);
        boolean useStress = useStressOption && input.stressedVowel() != null;

        List<Candidate> candidates = new ArrayList<>();
        for (Entry entry : entries.values()) {
            Candidate best = null;
            for (Pron pron : entry.prons()) {
                for (PronVariant variant : pron.variants()) {
                    double distance = Distance.phonemeDistance(input.segments(), variant.segments(), maxDistance);
                    if (Double.isInfinite(distance)) continue;
                    boolean stressMismatch = useStress
                            && variant.stressedVowel() != null
                            && !variant.stressedVowel().equals(input.stressedVowel());
                    if (stressMismatch) distance += STRESS_PENALTY;
                    if (distance <= maxDistance && (best == null || distance < best.distance())) {
                        best = new Candidate(entry, pron, variant, distance, stressMismatch);
                    }
                }
            }
            if (best != null) candidates.add(best);
        }

        Comparator<Candidate> order = Comparator
                .comparingDouble(Candidate::distance)
                .thenComparingInt(c -> sourceRank(c.entry().source()))
                .thenComparingInt(c -> Math.abs(c.variant().segments().size() - n))
                .thenComparingInt(c -> c.entry().word().length())
                .thenComparing(c -> c.entry().word(), JsStrings.LOCALE_ORDER);
        return candidates.stream().sorted(order).limit(limit)
                .map(c -> new PhonemeMatch(
                        c.entry().word(),
                        c.pron().display(),
                        c.entry().source(),
                        Math.round(c.distance() * 100) / 100.0,
                        c.distance() == 0,
                        c.stressMismatch(),
                        Distance.phonemeAlignment(input.segments(), c.variant().segments()).steps()))
                .toList();
    }

    private static Pron toPron(String display, PronVariant variant) {
        return new Pron(display, variant.segments().isEmpty() ? List.of() : List.of(variant));
    }

    private static int sourceRank(String source) {
        return source.equals("ldoce") ? 0 : 1;
    }

    public static String normalizeKey(String word) {
        return JsStrings.collapseSpaces(QUOTES.matcher(JsStrings.lower(JsStrings.trim(word))).replaceAll("'"));
    }

    /**
     * Clave "de cómo suena" para la ortografía: unifica grafías que suenan igual y todas las vocales.
     * "phonetic" y "fonetik" dan la misma clave: fanatak.
     */
    public static String soundKey(String word) {
        return JsStrings.lower(word)
                .replaceAll("[^a-z]", "")
                .replaceFirst("^kn", "n")
                .replaceFirst("^wr", "r")
                .replaceFirst("^ps", "s")
                .replace("ph", "f")
                .replace("gh", "")
                .replace("wh", "w")
                .replace("tch", "ch")
                .replace("dge", "j")
                .replace("ck", "k")
                .replaceAll("c(?=[eiy])", "s")
                .replaceAll("[cq]", "k")
                .replace("x", "ks")
                .replaceAll("[aeiouy]+", "a")
                .replaceAll("(.)\\1+", "$1");
    }
}
