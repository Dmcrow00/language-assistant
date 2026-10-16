package com.dmc00.fonetica.ldoce;

import com.dmc00.fonetica.api.LdoceEntry;
import com.dmc00.fonetica.api.LdocePronForm;
import com.dmc00.fonetica.core.JsStrings;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;

/**
 * Lectura de las páginas de Longman (ldoceonline.com). Estructura relevada en octubre de 2026:
 * <pre>
 *   &lt;span class="ldoceEntry Entry"&gt;
 *     &lt;span class="Head"&gt;            (o "frequent Head")
 *       &lt;span class="HWD"&gt;water&lt;/span&gt; &lt;span class="HOMNUM"&gt;1&lt;/span&gt;
 *       &lt;span class="PronCodes"&gt;
 *         &lt;span class="PRON"&gt;ˈwɔːtə&lt;/span&gt;                      ← británica (RP)
 *         &lt;span class="AMEVARPRON"&gt; $ ˈwɒːtər, ˈwɑː-&lt;/span&gt;   ← americana
 *       &lt;/span&gt;
 *       &lt;span class="POS"&gt; noun&lt;/span&gt;
 *       &lt;span data-src-mp3="…/breProns/….mp3" class="speaker brefile …"&gt;
 *       &lt;span data-src-mp3="…/ameProns/….mp3" class="speaker amefile …"&gt;
 *     &lt;/span&gt;
 *     &lt;span class="Sense"&gt; … &lt;span class="DEF"&gt;…&lt;/span&gt; &lt;/span&gt;
 * </pre>
 * Las function words traen varias formas separadas por etiquetas:
 * <pre>
 *   &lt;span class="PRON"&gt;ðə&lt;/span&gt;&lt;span class="STRONG"&gt;; before vowels&lt;/span&gt;&lt;span class="PRON"&gt; ði&lt;/span&gt;
 *   &lt;span class="STRONG"&gt;; strong&lt;/span&gt;&lt;span class="PRON"&gt; ðiː&lt;/span&gt;
 * </pre>
 * Los sonidos opcionales vienen como {@code <span class="i">ə</span>} (cursiva) y se pasan a "(ə)". Las
 * entradas de una misma palabra que no repiten la pronunciación heredan la anterior. Si Longman cambia el
 * HTML, este es el único archivo a tocar.
 */
public final class LdoceParser {

    /**
     * Versión del formato que guarda este parser. Si cambia lo que se extrae de la página, se sube y las
     * consultas guardadas con una versión anterior se vuelven a pedir. Es la misma numeración que tenía el
     * parser TypeScript: las consultas que ya están en la caché del usuario siguen valiendo.
     */
    public static final int PARSER_VERSION = 3;

    private static final Pattern COMMA = Pattern.compile(JsStrings.SPACE + "*," + JsStrings.SPACE + "*");

    private LdoceParser() {
    }

    public static List<LdoceEntry> parseEntryPage(String html) {
        Document root = Jsoup.parse(html);
        List<LdoceEntry> entries = new ArrayList<>();
        LdoceEntry previous = null;

        for (Element entryEl : root.select(".ldoceEntry")) {
            Element head = entryEl.selectFirst(".Head");
            String headword = head == null ? null : clean(textOf(head.selectFirst(".HWD")));
            if (head == null || headword == null) continue;

            String homnum = clean(textOf(head.selectFirst(".HOMNUM")));
            String pos = clean(textOf(head.selectFirst(".POS")));

            List<LdocePronForm> forms = pronForms(head);
            String pronBrE = forms.isEmpty() ? null : forms.getFirst().pron();
            List<LdocePronForm> pronFormsBrE = forms.size() > 1 ? forms : null;
            Element ameEl = head.selectFirst(".AMEVARPRON");
            String pronAmE = ameEl == null ? null : pronText(ameEl);

            String audioBrE = attribute(head.selectFirst(".brefile"), "data-src-mp3");
            String audioAmE = attribute(head.selectFirst(".amefile"), "data-src-mp3");

            Element defEl = entryEl.selectFirst(".Sense .DEF");
            if (defEl == null) defEl = entryEl.selectFirst(".DEF");
            // Las referencias cruzadas traen el número de homógrafo ("think1"): se quita antes de leer el texto.
            if (defEl != null) defEl.select(".HOMNUM").remove();
            String definition = clean(textOf(defEl));

            if (pronBrE == null && previous != null && previous.headword().equals(headword)) {
                pronBrE = previous.pronBrE();
                if (previous.pronFormsBrE() != null) pronFormsBrE = previous.pronFormsBrE();
                if (pronAmE == null) pronAmE = previous.pronAmE();
                if (audioBrE == null) audioBrE = previous.audioBrE();
                if (audioAmE == null) audioAmE = previous.audioAmE();
            }
            LdoceEntry entry = new LdoceEntry(headword, homnum, pos, pronBrE, pronFormsBrE, pronAmE, audioBrE,
                    audioAmE, definition);
            entries.add(entry);
            previous = entry;
        }
        return entries;
    }

    /** Página de "Did you mean…?" que Longman muestra cuando la palabra no existe. */
    public static List<String> parseSpellcheckPage(String html) {
        Document root = Jsoup.parse(html);
        LinkedHashSet<String> words = new LinkedHashSet<>();
        for (Element a : root.select(".didyoumean li a")) {
            String word = clean(a.wholeText());
            if (word != null && !word.startsWith("-") && !word.endsWith("-")) words.add(word);
        }
        return List.copyOf(words);
    }

    /** Recorre las PRON británicas en orden, asignándole a cada una la etiqueta STRONG que la precede. */
    private static List<LdocePronForm> pronForms(Element head) {
        Element codes = head.selectFirst(".PronCodes");
        List<LdocePronForm> forms = new ArrayList<>();
        if (codes == null) {
            Element single = head.selectFirst(".PRON");
            if (single != null) forms.add(new LdocePronForm(null, pronText(single)));
            return forms;
        }
        String label = null;
        for (Element node : codes.children()) {
            // Después del "$" todo es de la variante americana (for /fə; strong fɔː $ fər strong fɔːr/).
            if (hasClass(node, "AMEVARPRON")) break;
            if (hasClass(node, "STRONG")) {
                label = clean(pronText(node));
            } else if (hasClass(node, "PRON")) {
                String pron = pronText(node);
                if (!pron.isEmpty()) forms.add(new LdocePronForm(label, pron));
                label = null;
            }
        }
        return forms;
    }

    /** Texto de la pronunciación: descarta los separadores ("/", "$") y marca lo opcional entre paréntesis. */
    private static String pronText(Element el) {
        StringBuilder out = new StringBuilder();
        for (Node child : el.childNodes()) walk(child, out);
        String text = JsStrings.collapseSpaces(out.toString());
        return JsStrings.trim(COMMA.matcher(text).replaceAll(", "));
    }

    private static void walk(Node node, StringBuilder out) {
        if (node instanceof TextNode text) {
            out.append(text.getWholeText());
            return;
        }
        if (node instanceof Element element) {
            if (hasClass(element, "neutral")) return;
            if (hasClass(element, "i")) {
                out.append('(').append(element.wholeText()).append(')');
                return;
            }
            for (Node child : element.childNodes()) walk(child, out);
        }
    }

    /** Clase exacta, distinguiendo mayúsculas como el classList del navegador ({@code hasClass} de jsoup no lo hace). */
    private static boolean hasClass(Element element, String className) {
        return element.classNames().contains(className);
    }

    /** El texto tal cual está en la página (sin normalizar espacios), o null si no hay elemento. */
    private static String textOf(Element element) {
        return element == null ? null : element.wholeText();
    }

    private static String attribute(Element element, String name) {
        if (element == null || !element.hasAttr(name)) return null;
        String value = element.attr(name);
        return value.isEmpty() ? null : value;
    }

    private static String clean(String text) {
        if (text == null) return null;
        String value = JsStrings.trim(JsStrings.collapseSpaces(text));
        return value.isEmpty() ? null : value;
    }
}
