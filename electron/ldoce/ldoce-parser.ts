import { HTMLElement, Node, NodeType, parse } from 'node-html-parser';
import type { LdocePronForm, LdoceEntry } from '../../shared/fonetica-api';

/**
 * Versión del formato que guarda este parser. Si cambia lo que se extrae de la página, se sube
 * y las consultas guardadas con una versión anterior se vuelven a pedir.
 */
export const PARSER_VERSION = 3;

/**
 * Lectura de las páginas de Longman (ldoceonline.com). Estructura relevada en octubre de 2026:
 *
 *   <span class="ldoceEntry Entry">
 *     <span class="Head">            (o "frequent Head")
 *       <span class="HWD">water</span> <span class="HOMNUM">1</span>
 *       <span class="PronCodes">
 *         <span class="PRON">ˈwɔːtə</span>                       ← británica (RP)
 *         <span class="AMEVARPRON"> $ ˈwɒːtər, ˈwɑː-</span>    ← americana
 *       </span>
 *       <span class="POS"> noun</span>
 *       <span data-src-mp3="…/breProns/….mp3" class="speaker brefile …">
 *       <span data-src-mp3="…/ameProns/….mp3" class="speaker amefile …">
 *     </span>
 *     <span class="Sense"> … <span class="DEF">…</span> </span>
 *
 * Las function words traen varias formas separadas por etiquetas:
 *   <span class="PRON">ðə</span><span class="STRONG">; before vowels</span><span class="PRON"> ði</span>
 *   <span class="STRONG">; strong</span><span class="PRON"> ðiː</span>
 *
 * Los sonidos opcionales vienen como <span class="i">ə</span> (cursiva) y los pasamos a "(ə)".
 * Las entradas de una misma palabra que no repiten la pronunciación heredan la anterior.
 * Si Longman cambia el HTML, este es el único archivo a tocar.
 */

export function parseEntryPage(html: string): LdoceEntry[] {
  const root = parse(html);
  const entries: LdoceEntry[] = [];
  let previous: LdoceEntry | undefined;

  for (const entryEl of root.querySelectorAll('.ldoceEntry')) {
    const head = entryEl.querySelector('.Head');
    const headword = clean(head?.querySelector('.HWD')?.text);
    if (!head || !headword) continue;

    const entry: LdoceEntry = { headword };
    const homnum = clean(head.querySelector('.HOMNUM')?.text);
    if (homnum) entry.homnum = homnum;
    const pos = clean(head.querySelector('.POS')?.text);
    if (pos) entry.pos = pos;

    const forms = pronForms(head);
    if (forms.length) entry.pronBrE = forms[0].pron;
    if (forms.length > 1) entry.pronFormsBrE = forms;
    const ameEl = head.querySelector('.AMEVARPRON');
    if (ameEl) entry.pronAmE = pronText(ameEl);

    const audioBrE = head.querySelector('.brefile')?.getAttribute('data-src-mp3');
    const audioAmE = head.querySelector('.amefile')?.getAttribute('data-src-mp3');
    if (audioBrE) entry.audioBrE = audioBrE;
    if (audioAmE) entry.audioAmE = audioAmE;

    const defEl = entryEl.querySelector('.Sense .DEF') ?? entryEl.querySelector('.DEF');
    // Las referencias cruzadas traen el número de homógrafo ("think1"): se quita antes de leer el texto.
    defEl?.querySelectorAll('.HOMNUM').forEach((n) => n.remove());
    const definition = clean(defEl?.text);
    if (definition) entry.definition = definition;

    if (!entry.pronBrE && previous && previous.headword === entry.headword) {
      entry.pronBrE = previous.pronBrE;
      if (previous.pronFormsBrE) entry.pronFormsBrE = previous.pronFormsBrE;
      entry.pronAmE ??= previous.pronAmE;
      entry.audioBrE ??= previous.audioBrE;
      entry.audioAmE ??= previous.audioAmE;
    }
    entries.push(entry);
    previous = entry;
  }
  return entries;
}

/** Página de "Did you mean…?" que Longman muestra cuando la palabra no existe. */
export function parseSpellcheckPage(html: string): string[] {
  const root = parse(html);
  const words = root
    .querySelectorAll('.didyoumean li a')
    .map((a) => clean(a.text))
    .filter((w): w is string => !!w && !w.startsWith('-') && !w.endsWith('-'));
  return [...new Set(words)];
}

/** Recorre las PRON británicas en orden, asignándole a cada una la etiqueta STRONG que la precede. */
function pronForms(head: HTMLElement): LdocePronForm[] {
  const codes = head.querySelector('.PronCodes');
  const forms: LdocePronForm[] = [];
  if (!codes) {
    const single = head.querySelector('.PRON');
    return single ? [{ pron: pronText(single) }] : [];
  }
  let label: string | undefined;
  for (const node of codes.childNodes) {
    if (!(node instanceof HTMLElement)) continue;
    // Después del "$" todo es de la variante americana (for /fə; strong fɔː $ fər strong fɔːr/).
    if (node.classList.contains('AMEVARPRON')) break;
    if (node.classList.contains('STRONG')) {
      label = clean(pronText(node));
    } else if (node.classList.contains('PRON')) {
      const pron = pronText(node);
      if (pron) forms.push(label ? { label, pron } : { pron });
      label = undefined;
    }
  }
  return forms;
}

/** Texto de la pronunciación: descarta los separadores ("/", "$") y marca lo opcional entre paréntesis. */
function pronText(el: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === NodeType.TEXT_NODE) {
      out += node.text;
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.classList.contains('neutral')) return;
      if (node.classList.contains('i')) {
        out += `(${node.text})`;
        return;
      }
      node.childNodes.forEach(walk);
    }
  };
  el.childNodes.forEach(walk);
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function clean(text: string | undefined): string | undefined {
  const value = text?.replace(/\s+/g, ' ').trim();
  return value ? value : undefined;
}
