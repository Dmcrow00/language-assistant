import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioCache, LdoceCache } from '../ldoce/ldoce-cache';
import { FetchLike, LdoceClient } from '../ldoce/ldoce-client';
import { parseEntryPage, parseSpellcheckPage } from '../ldoce/ldoce-parser';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// HTML mínimo armado a mano con la misma estructura que usan las páginas de Longman.
const ENTRY_PAGE = `
<div class="dictionary">
  <span class="ldoceEntry Entry">
    <span class="frequent Head"><span class="HWD">water</span><span class="HYPHENATION">wa‧ter</span><span class="HOMNUM">1</span>
      <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">ˈwɔːtə</span><span class="AMEVARPRON"><span class="neutral span"> $ </span>ˈwɒːtər, ˈwɑː-</span><span class="neutral span">/</span></span>
      <span class="POS"> noun</span>
      <span data-src-mp3="https://www.ldoceonline.com/media/english/breProns/water_br.mp3?version=1" class="speaker brefile"> </span>
      <span data-src-mp3="https://www.ldoceonline.com/media/english/ameProns/water_am.mp3?version=1" class="speaker amefile"> </span>
    </span>
    <span class="Sense"><span class="DEF">the clear liquid that falls as rain</span>
      <span data-src-mp3="https://www.ldoceonline.com/media/english/exaProns/x.mp3" class="speaker exafile"> </span></span>
  </span>
  <span class="ldoceEntry Entry">
    <span class="frequent Head"><span class="HWD">water</span><span class="HOMNUM">2</span><span class="POS"> verb</span></span>
    <span class="Sense"><span class="DEF">to pour <a class="defRef">water<span class="HOMNUM">1</span></a> on plants</span></span>
  </span>
  <span class="bussdictEntry Entry"><span class="Head"><span class="HWD">water</span><span class="PRON">otra</span></span></span>
</div>`;

const OPTIONAL_PAGE = `<span class="ldoceEntry Entry"><span class="Head"><span class="HWD">government</span>
  <span class="PronCodes"><span class="neutral span"> /</span><span class="PRON">ˈɡʌv<span class="i">ə</span>mənt, ˈɡʌv<span class="i">ə</span>nmənt</span><span class="neutral span">/</span></span>
  <span class="POS"> noun</span></span></span>`;

const SPELLCHECK_PAGE = `<ul class="didyoumean"><li><a href="/search/direct/?q=watered"> watered </a></li>
  <li><a href="/search/direct/?q=-ware">-ware</a></li><li><a href="/search/direct/?q=water">water</a></li></ul>`;

describe('parser de Longman', () => {
  it('lee palabra, pronunciaciones, audios y definición; ignora el diccionario de negocios', () => {
    const entries = parseEntryPage(ENTRY_PAGE);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0], {
      headword: 'water',
      homnum: '1',
      pos: 'noun',
      pronBrE: 'ˈwɔːtə',
      pronAmE: 'ˈwɒːtər, ˈwɑː-',
      audioBrE: 'https://www.ldoceonline.com/media/english/breProns/water_br.mp3?version=1',
      audioAmE: 'https://www.ldoceonline.com/media/english/ameProns/water_am.mp3?version=1',
      definition: 'the clear liquid that falls as rain',
    });
  });

  it('la segunda entrada hereda la pronunciación de la primera', () => {
    const verb = parseEntryPage(ENTRY_PAGE)[1];
    assert.equal(verb.pos, 'verb');
    assert.equal(verb.definition, 'to pour water on plants');
    assert.equal(verb.pronBrE, 'ˈwɔːtə');
    assert.ok(verb.audioBrE?.includes('water_br.mp3'));
  });

  it('marca los sonidos opcionales entre paréntesis', () => {
    assert.equal(parseEntryPage(OPTIONAL_PAGE)[0].pronBrE, 'ˈɡʌv(ə)mənt, ˈɡʌv(ə)nmənt');
  });

  it('lee las sugerencias de "Did you mean" sin prefijos ni sufijos sueltos', () => {
    assert.deepEqual(parseSpellcheckPage(SPELLCHECK_PAGE), ['watered', 'water']);
  });
});

describe('cliente de Longman', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'fonetica-test-'));

  function fakeFetch(pages: Record<string, { url: string; html: string }>): {
    fetch: FetchLike;
    calls: string[];
  } {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(url);
      const query = new URL(url).searchParams.get('q') ?? '';
      const page = pages[query];
      return {
        ok: !!page,
        status: page ? 200 : 500,
        url: page?.url ?? url,
        text: async () => page?.html ?? '',
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    };
    return { fetch, calls };
  }

  it('distingue página de palabra y página de sugerencias, y usa la caché', async () => {
    const { fetch, calls } = fakeFetch({
      water: { url: 'https://www.ldoceonline.com/dictionary/water', html: ENTRY_PAGE },
      watre: {
        url: 'https://www.ldoceonline.com/spellcheck/english/?q=watre',
        html: SPELLCHECK_PAGE,
      },
    });
    const client = new LdoceClient(
      fetch,
      new LdoceCache(join(tempDir, 'c.json')),
      new AudioCache(join(tempDir, 'a')),
      0,
    );

    const found = await client.lookup('Water ');
    assert.equal(found.status, 'found');
    assert.equal(found.entries[0].pronBrE, 'ˈwɔːtə');

    const suggestions = await client.lookup('watre');
    assert.equal(suggestions.status, 'suggestions');
    assert.deepEqual(suggestions.suggestions, ['watered', 'water']);

    const again = await client.lookup('water');
    assert.equal(again.fromCache, true);
    assert.equal(calls.length, 2);
  });

  it('si Longman no responde devuelve "offline" sin guardar en caché', async () => {
    const { fetch, calls } = fakeFetch({});
    const client = new LdoceClient(
      fetch,
      new LdoceCache(join(tempDir, 'd.json')),
      new AudioCache(join(tempDir, 'a')),
      0,
    );
    assert.equal((await client.lookup('zzz')).status, 'offline');
    assert.equal((await client.lookup('zzz')).status, 'offline');
    assert.equal(calls.length, 2);
  });

  it('rechaza audios que no son de Longman', async () => {
    const { fetch } = fakeFetch({});
    const client = new LdoceClient(
      fetch,
      new LdoceCache(join(tempDir, 'e.json')),
      new AudioCache(join(tempDir, 'a')),
      0,
    );
    await assert.rejects(client.audio('https://example.com/media/x.mp3'));
    await assert.rejects(client.audio('https://www.ldoceonline.com/dictionary/cat'));
  });
});
