package com.dmc00.fonetica.core;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Function words con forma fuerte y débil (Roach, "English Phonetics and Phonology", cap. 12), escritas
 * en la notación de Longman. Esta tabla se usa mientras la palabra no se consultó en Longman; cuando hay
 * datos de Longman (the /ðə; before vowels ði; strong ðiː/) mandan esos.
 *
 * <ul>
 *   <li>weak: formas débiles; la primera es la habitual ante consonante. Si hay una con /h/ y otra sin /h/,
 *       la /h/ se pronuncia sólo al comienzo de la oración (Roach: "his" /ɪz/ ~ /hɪz/).</li>
 *   <li>weakBeforeVowel: forma débil distinta ante vocal (the → ði, to → tʊ).</li>
 * </ul>
 * Las que terminan en "r" escrita (for, her, are...) no necesitan forma ante vocal: la /r/ de enlace se
 * agrega con la regla general (for‿it → /fər ɪt/).
 */
public final class FunctionWords {

    /** @param weakBeforeVowel opcional */
    public record Forms(String category, List<String> weak, String weakBeforeVowel, String strong) {
    }

    /** @param ambiguous opcional: aviso cuando la forma depende del sentido */
    public record Decision(String form, String reason, String ambiguous) {
    }

    /**
     * Contexto de la palabra dentro de la oración.
     *
     * @param next            la palabra siguiente (clave en minúsculas) o null
     * @param sentenceInitial primera palabra de la oración
     * @param beforePause     después viene una pausa (coma, punto, fin del texto)
     * @param question        la oración termina en "?"
     * @param override        forma elegida por el alumno ("weak" / "strong"), si eligió una
     */
    public record Context(String key, String next, boolean sentenceInitial, boolean beforePause, boolean question,
                          String override, boolean connected) {
    }

    public static final Map<String, Forms> FUNCTION_WORDS = new LinkedHashMap<>();

    static {
        add("a", "artículo", List.of("ə"), null, "eɪ");
        add("an", "artículo", List.of("ən"), null, "æn");
        add("the", "artículo", List.of("ðə"), "ði", "ðiː");
        add("and", "conjunción", List.of("(ə)n", "(ə)nd"), "(ə)nd", "ænd");
        add("but", "conjunción", List.of("bət"), null, "bʌt");
        add("that", "conjunción / relativo", List.of("ðət"), null, "ðæt");
        add("than", "conjunción", List.of("ðən"), null, "ðæn");
        add("as", "conjunción / preposición", List.of("əz"), null, "æz");
        add("at", "preposición", List.of("ət"), null, "æt");
        add("for", "preposición", List.of("fə"), null, "fɔː");
        add("from", "preposición", List.of("frəm"), null, "frɒm");
        add("of", "preposición", List.of("əv"), null, "ɒv");
        add("to", "preposición", List.of("tə"), "tʊ", "tuː");
        add("some", "determinante", List.of("səm"), null, "sʌm");
        add("there", "there existencial", List.of("ðə"), null, "ðeə");
        add("his", "determinante posesivo", List.of("ɪz", "hɪz"), null, "hɪz");
        add("her", "pronombre / posesivo", List.of("ə", "hə"), null, "hɜː");
        add("your", "determinante posesivo", List.of("jə"), null, "jɔː");
        add("he", "pronombre", List.of("i", "hi"), null, "hiː");
        add("she", "pronombre", List.of("ʃi"), null, "ʃiː");
        add("we", "pronombre", List.of("wi"), null, "wiː");
        add("you", "pronombre", List.of("ju"), null, "juː");
        add("me", "pronombre", List.of("mi"), null, "miː");
        add("him", "pronombre", List.of("ɪm", "hɪm"), null, "hɪm");
        add("them", "pronombre", List.of("ðəm"), null, "ðem");
        add("us", "pronombre", List.of("əs"), null, "ʌs");
        add("can", "auxiliar modal", List.of("kən"), null, "kæn");
        add("could", "auxiliar modal", List.of("kəd"), null, "kʊd");
        add("shall", "auxiliar modal", List.of("ʃəl"), null, "ʃæl");
        add("should", "auxiliar modal", List.of("ʃəd"), null, "ʃʊd");
        add("must", "auxiliar modal", List.of("məs", "məst"), "məst", "mʌst");
        add("would", "auxiliar modal", List.of("wəd", "əd"), null, "wʊd");
        add("will", "auxiliar modal", List.of("wəl", "əl"), null, "wɪl");
        add("have", "auxiliar", List.of("əv", "həv"), null, "hæv");
        add("has", "auxiliar", List.of("əz", "həz"), null, "hæz");
        add("had", "auxiliar", List.of("əd", "həd"), null, "hæd");
        add("do", "auxiliar", List.of("də"), "dʊ", "duː");
        add("does", "auxiliar", List.of("dəz"), null, "dʌz");
        add("am", "verbo be", List.of("əm"), null, "æm");
        add("are", "verbo be", List.of("ə"), null, "ɑː");
        add("was", "verbo be", List.of("wəz"), null, "wɒz");
        add("were", "verbo be", List.of("wə"), null, "wɜː");
        add("be", "verbo be", List.of("bi"), null, "biː");
        add("been", "verbo be", List.of("bɪn"), null, "biːn");
    }

    private static final Set<String> PERSONAL_PRONOUNS = Set.of("he", "she", "we", "you", "me", "him", "her", "them", "us");
    private static final Set<String> SUBJECT_PRONOUNS = Set.of("i", "you", "he", "she", "it", "we", "they", "there");
    /** Palabras con las que suele empezar un sujeto: después de ellas "that" es conjunción o relativo. */
    private static final Set<String> SUBJECT_STARTERS = new HashSet<>(SUBJECT_PRONOUNS);

    static {
        SUBJECT_STARTERS.addAll(Set.of("the", "a", "an", "this", "these", "those", "my", "your", "his", "her", "its",
                "our", "their", "someone", "somebody", "everyone", "everybody", "nobody", "people"));
    }

    /** Después de "there", indican el there existencial ("there is..."). */
    private static final Set<String> EXISTENTIAL_FOLLOWERS = Set.of("is", "'s", "are", "was", "were", "will", "'ll",
            "would", "be", "been", "has", "have", "had", "must", "may", "might", "could", "should", "can", "seems",
            "seem", "seemed", "appears", "used");

    private static final Set<String> IRREGULAR_PARTICIPLES = Set.of((
            "been got gotten done gone had made seen said taken come become written given known left lost "
                    + "found thought told heard felt kept brought bought caught taught sent spent built meant met paid "
                    + "put read run sat stood understood won begun broken chosen drunk eaten fallen forgotten hidden "
                    + "ridden risen shown spoken stolen sung swum thrown woken worn driven flown grown drawn let cut hit "
                    + "set shut hurt cost beaten bitten blown fed fought forgiven frozen held hung laid led lent lit "
                    + "rung shaken shot slept sold sworn swept torn wept wound").split(" "));

    private static final Pattern PARTICIPLE_ENDING = Pattern.compile("(ed|en|wn)\\z");
    private static final Pattern STRESS_OR_PAREN = Pattern.compile("[ˈˌ(]");

    private FunctionWords() {
    }

    private static void add(String word, String category, List<String> weak, String weakBeforeVowel, String strong) {
        FUNCTION_WORDS.put(word, new Forms(category, weak, weakBeforeVowel, strong));
    }

    /**
     * Decide forma fuerte o débil según Roach: la forma débil es la normal en habla conectada; la fuerte
     * va al final de la oración o antes de una pausa (salvo los pronombres personales), cuando la palabra
     * está enfatizada o en contraste, y en ciertos usos (that demostrativo, there de lugar, have/do como
     * verbo principal).
     */
    public static Decision decideForm(Context ctx) {
        if (!ctx.connected()) {
            return new Decision("strong", "Forma de cita: el habla conectada está desactivada.", null);
        }
        if ("strong".equals(ctx.override())) {
            return new Decision("strong", "La marcaste como enfatizada o en contraste: va en forma fuerte.", null);
        }
        if ("weak".equals(ctx.override())) {
            return new Decision("weak", "La marcaste sin énfasis: va en forma débil.", null);
        }

        if (ctx.beforePause()) {
            if (PERSONAL_PRONOUNS.contains(ctx.key())) {
                return new Decision("weak", "Los pronombres personales mantienen la forma débil también al final.", null);
            }
            return new Decision("strong",
                    "Al final de la oración o antes de una pausa se usa la forma fuerte («Where are you from?»).", null);
        }

        String next = ctx.next();
        switch (ctx.key()) {
            case "that" -> {
                return next != null && SUBJECT_STARTERS.contains(next)
                        ? new Decision("weak",
                                "Como conjunción o pronombre relativo («I think that he…») va débil.",
                                "Si es demostrativo («that book», «I like that») va fuerte: /ðæt/.")
                        : new Decision("strong",
                                "Como demostrativo («that book») va fuerte.",
                                "Si es conjunción o relativo («the man that I saw») va débil: /ðət/.");
            }
            case "there" -> {
                return next != null && EXISTENTIAL_FOLLOWERS.contains(next)
                        ? new Decision("weak", "«There» existencial («there is / there are») va débil.", null)
                        : new Decision("strong",
                                "Como adverbio de lugar («over there», «go there») va fuerte.", null);
            }
            case "some" -> {
                return "of".equals(next)
                        ? new Decision("strong", "Como pronombre («some of them») va fuerte.", null)
                        : new Decision("weak",
                                "Delante de un sustantivo, con el sentido de «algo de / unos», va débil.",
                                "Con el sentido de «cierto, alguno en particular» («Some people say…») va fuerte.");
            }
            case "have", "has", "had" -> {
                return next != null && (isParticiple(next) || SUBJECT_PRONOUNS.contains(next))
                        ? new Decision("weak",
                                "Como auxiliar («have seen», «has done») va débil.",
                                "Como verbo principal («I have a car», «have to») suele ir fuerte.")
                        : new Decision("strong",
                                "Como verbo principal («have a car», «have to») suele ir fuerte.",
                                "Si es auxiliar de un tiempo perfecto va débil.");
            }
            case "do", "does" -> {
                return next != null
                        && (SUBJECT_PRONOUNS.contains(next) || (ctx.question() && SUBJECT_STARTERS.contains(next)))
                        ? new Decision("weak",
                                "Como auxiliar en preguntas («Do you…?», «What does she…?») va débil.", null)
                        : new Decision("strong",
                                "Como verbo principal («do the shopping») o en negativas va fuerte.",
                                "Si es auxiliar de una pregunta va débil.");
            }
            default -> {
                return new Decision("weak", "Sin énfasis, en habla conectada, las function words van en forma débil.",
                        null);
            }
        }
    }

    private static boolean isParticiple(String word) {
        return IRREGULAR_PARTICIPLES.contains(word) || PARTICIPLE_ENDING.matcher(word).find();
    }

    /**
     * Elige entre las formas débiles. Si hay variantes con y sin /h/, la /h/ se pronuncia sólo al comienzo
     * de la oración. Ante vocal se usa la forma específica si existe.
     */
    public static String pickWeakForm(List<String> weak, String weakBeforeVowel, boolean sentenceInitial,
                                      boolean nextStartsWithVowel) {
        if (nextStartsWithVowel && JsStrings.truthy(weakBeforeVowel)) return weakBeforeVowel;
        String withH = weak.stream().filter(FunctionWords::startsWithH).findFirst().orElse(null);
        String withoutH = weak.stream().filter(w -> !startsWithH(w)).findFirst().orElse(null);
        if (withH != null && withoutH != null) return sentenceInitial ? withH : withoutH;
        return weak.isEmpty() ? null : weak.getFirst();
    }

    private static boolean startsWithH(String form) {
        return STRESS_OR_PAREN.matcher(form).replaceAll("").startsWith("h");
    }
}
