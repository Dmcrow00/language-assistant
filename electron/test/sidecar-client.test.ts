import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { SentenceAnalysis } from '../../shared/fonetica-api';
import { SidecarClient } from '../sidecar-client';

const ROOT = join(__dirname, '..', '..', '..');

describe('cliente del motor (con un motor falso)', () => {
  const fake = () =>
    new SidecarClient({ file: process.execPath, args: [join(__dirname, 'fake-sidecar.js')] }, 1500);

  it('espera el aviso de listo, ignora las líneas ajenas y empareja cada respuesta con su pedido', async () => {
    const client = fake();
    const [a, b] = await Promise.all([client.call('echo', 'uno'), client.call('echo', 2, { x: true })]);
    assert.deepEqual(a, ['uno']);
    assert.deepEqual(b, [2, { x: true }]);
    client.dispose();
  });

  it('los canales de audio devuelven los bytes', async () => {
    const client = fake();
    const bytes = await client.call<Uint8Array>('bytes');
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(Buffer.from(bytes).toString('ascii'), 'RIFF');
    client.dispose();
  });

  it('un error del motor llega como error con el mismo mensaje', async () => {
    const client = fake();
    await assert.rejects(client.call('error'), { message: 'Se esperaba un texto' });
    client.dispose();
  });

  it('si el motor no responde a tiempo, el pedido falla', async () => {
    const client = fake();
    await assert.rejects(client.call('silencio'), { message: 'El motor tardó demasiado en responder.' });
    client.dispose();
  });

  it('si el motor se cae, fallan los pedidos en curso y el próximo lo vuelve a lanzar', async () => {
    const client = fake();
    await assert.rejects(client.call('salir'), { message: 'El motor se cerró (código 3).' });
    assert.deepEqual(await client.call('echo', 'otra vez'), ['otra vez']);
    client.dispose();
  });

  it('si no se puede lanzar, lo informa', async () => {
    const client = new SidecarClient({ file: join(ROOT, 'no-existe.exe'), args: [] });
    await assert.rejects(client.call('echo'), /No se pudo iniciar el motor/);
  });
});

// Con el motor Java compilado (npm run build:sidecar): el mismo contrato de punta a punta.
const userData = mkdtempSync(join(tmpdir(), 'fonetica-electron-test-'));
const real = SidecarClient.locate({
  resourcesDir: join(ROOT, 'resources'),
  projectDir: ROOT,
  packaged: false,
  userData,
  userAgent: 'test',
});
const jarBuilt = existsSync(join(ROOT, 'sidecar-java', 'target', 'sidecar', 'fonetica-sidecar.jar'));

describe('motor Java real', { skip: !real || !jarBuilt }, () => {
  after(() => {
    real?.dispose();
    rmSync(userData, { recursive: true, force: true });
  });

  it('responde el diccionario', async () => {
    const info = await real!.call<{ total: number; fromLdoce: number }>('lexicon:info');
    assert.equal(info.total, 15212);
  });

  it('la oración llega igual que la daba el motor TypeScript (dato dorado)', async () => {
    const golden = JSON.parse(
      readFileSync(join(ROOT, 'sidecar-java', 'src', 'test', 'resources', 'paridad', 'oraciones.json'), 'utf8'),
    ) as Array<{ text: string; options: unknown; analysis: SentenceAnalysis }>;
    for (const text of ['Where are you from?', "Don't you know?", 'The idea of it.']) {
      const expected = golden.find(
        (c) => c.text === text && (c.options as { connected: boolean }).connected,
      )!;
      const actual = await real!.call('sentence:analyze', text, expected.options);
      assert.deepEqual(actual, expected.analysis, text);
    }
  });

  it('valida la entrada también del lado de Java', async () => {
    await assert.rejects(real!.call('lexicon:search-spelling', 42), { message: 'Se esperaba un texto' });
  });

  it('la voz devuelve un WAV', async () => {
    if (!(await real!.call<boolean>('tts:available'))) return;
    const wav = await real!.call<Uint8Array>('tts:phonemes', 'kæt', { slow: false });
    assert.equal(Buffer.from(wav.subarray(0, 4)).toString('ascii'), 'RIFF');
  });
});
