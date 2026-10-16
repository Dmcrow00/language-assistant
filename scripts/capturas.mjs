// Abre la app (con el motor Java), recorre las pantallas principales y guarda una captura de cada una en
// docs/capturas/. Sirve para la prueba manual de cada versión (docs/manual-de-usuario.md) y para ver de
// un vistazo que la interfaz y el motor funcionan juntos.
//
//   npm run build && npm run build:sidecar && node scripts/capturas.mjs
//
// Maneja la ventana con el protocolo de DevTools de Chromium (--remote-debugging-port), sin dependencias.
// Usa la carpeta de datos real de la app: la búsqueda de "thought" consulta Longman si no está en la caché.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'capturas');
const port = 9333;
const electron = createRequire(import.meta.url)('electron');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mkdirSync(out, { recursive: true });
const app = spawn(electron, ['.', `--remote-debugging-port=${port}`], {
  cwd: root,
  stdio: 'inherit',
});

try {
  const page = await connect();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  // Siempre el tema claro y el mismo tamaño, así las capturas se comparan entre versiones.
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitFor(page, `document.querySelector('.nav-item') !== null`);
  await sleep(1500);

  const screens = [
    { file: '01-inicio.png', nav: 'Inicio' },
    {
      file: '02-buscar-palabra.png',
      nav: 'Buscar palabra',
      run: async () => {
        await type(page, 'input', 'thought');
        await sleep(800);
        await key(page, 'input', 'Enter');
      },
      // Hasta que llega la entrada de Longman (o se informa que no hay conexión).
      wait: `!document.body.innerText.includes('Buscando «thought»')`,
    },
    {
      file: '03-teclado-fonetico.png',
      nav: 'Teclado fonético',
      run: async () => {
        for (const symbol of ['θ', 'ɔː', 't']) await pressKey(page, symbol);
      },
      wait: `document.body.innerText.includes('thought')`,
    },
    {
      file: '04-transcribir-oracion.png',
      nav: 'Transcribir oración',
      run: async () => {
        await type(page, 'textarea', 'There is a book over there. Look at that cat!');
        await clickText(page, 'button', 'Transcribir');
      },
      // Cada palabra se confirma en Longman (una consulta por segundo).
      wait: `document.body.innerText.includes('ðə') && !document.body.innerText.includes('Confirmando la pronunciación')`,
    },
    { file: '05-dictado.png', nav: 'Dictado' },
    { file: '06-pares-minimos.png', nav: 'Pares mínimos' },
    {
      file: '07-analizar-oracion.png',
      nav: 'Analizar oración',
      run: async () => {
        await type(page, 'textarea', 'The man who lives next door is a doctor.');
        await clickText(page, 'button', 'Analizar');
      },
      // La primera vez el analizador spaCy tarda unos segundos en arrancar.
      wait: `!document.body.innerText.includes('Analizando') && document.body.innerText.includes('cláusula independiente')`,
    },
    { file: '08-grupo-verbal.png', nav: 'Grupo verbal' },
    { file: '09-verbos-irregulares.png', nav: 'Verbos irregulares' },
    { file: '10-ejercicios.png', nav: 'Ejercicios' },
    { file: '11-ayuda.png', nav: 'Ayuda' },
    { file: '12-acerca-de.png', nav: 'Acerca de la app' },
  ];

  for (const screen of screens) {
    await clickText(page, '.nav-item', screen.nav);
    await sleep(600);
    if (screen.run) await screen.run();
    if (screen.wait) await waitFor(page, screen.wait, 60_000);
    await sleep(900);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, screen.file), Buffer.from(data, 'base64'));
    console.log(`ok  docs/capturas/${screen.file}`);
  }
  page.close();
} finally {
  app.kill();
}

/** Espera la ventana de la app y se conecta a su página. */
async function connect() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = targets.find((t) => t.type === 'page' && t.url.startsWith('app://bundle'));
      if (target) return cdp(target.webSocketDebuggerUrl);
    } catch {
      // Electron todavía no abrió el puerto.
    }
    await sleep(500);
  }
  throw new Error('La app no abrió su ventana');
}

function cdp(url) {
  const socket = new WebSocket(url);
  const waiting = new Map();
  let nextId = 1;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = waiting.get(message.id);
    if (!waiter) return;
    waiting.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const opened = new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
    },
    close: () => socket.close(),
  };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? expression);
  return result.value;
}

async function waitFor(page, condition, timeout = 15_000) {
  const start = Date.now();
  while (!(await evaluate(page, condition))) {
    if (Date.now() - start > timeout) throw new Error(`No se cumplió: ${condition}`);
    await sleep(250);
  }
}

/** Hace clic en el primer elemento que coincide con el selector y cuyo texto es (o empieza con) `text`. */
async function clickText(page, selector, text) {
  const clicked = await evaluate(
    page,
    `(() => {
      const items = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const wanted = ${JSON.stringify(text)};
      const item = items.find((el) => el.innerText.trim() === wanted)
        ?? items.find((el) => el.innerText.trim().startsWith(wanted));
      item?.click();
      return !!item;
    })()`,
  );
  if (!clicked) throw new Error(`No encontré "${text}" (${selector})`);
}

/** Toca una tecla del teclado fonético (cada tecla muestra el símbolo y una palabra de ejemplo). */
async function pressKey(page, symbol) {
  const pressed = await evaluate(
    page,
    `(() => {
      const key = [...document.querySelectorAll('.key')]
        .find((el) => el.querySelector('.symbol')?.innerText.trim() === ${JSON.stringify(symbol)});
      key?.click();
      return !!key;
    })()`,
  );
  if (!pressed) throw new Error(`No encontré la tecla ${symbol}`);
  await sleep(300);
}

/** Escribe en el primer campo visible que coincide con el selector, como lo haría el teclado. */
async function type(page, selector, text) {
  await evaluate(
    page,
    `(() => {
      const field = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.offsetParent !== null);
      field.focus();
      field.value = ${JSON.stringify(text)};
      field.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  );
}

async function key(page, selector, keyName) {
  await evaluate(
    page,
    `(() => {
      const field = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.offsetParent !== null);
      field.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(keyName)}, bubbles: true }));
    })()`,
  );
}
