import { app, BrowserWindow, IpcMainInvokeEvent, Menu, net, protocol, shell } from 'electron';
import { readFileSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Lexicon } from './core/lexicon';
import { applyLookupToLexicon, registerIpc } from './ipc';
import { AudioCache, LdoceCache } from './ldoce/ldoce-cache';
import { LDOCE_ORIGIN, LdoceClient } from './ldoce/ldoce-client';
import { PiperVoice } from './tts/piper-voice';
import { NlpClient } from './grammar/nlp-client';

/**
 * Proceso principal: arma el diccionario local, conecta Longman y abre la ventana.
 * La interfaz (Angular) se sirve con el protocolo propio app://bundle/ en producción,
 * o desde `ng serve` en desarrollo (npm run dev pasa --dev-url).
 */

const APP_ORIGIN = 'app://bundle';
const devUrl = process.argv.find((a) => a.startsWith('--dev-url='))?.slice('--dev-url='.length);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow: BrowserWindow | null = null;
let ldoceCache: LdoceCache | null = null;
let nlp: NlpClient | null = null;

function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
}

function serveAngularBuild(): void {
  const webRoot = join(app.getAppPath(), 'dist', 'dmc00-language-assistant', 'browser');
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const requested = normalize(
      join(webRoot, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)),
    );
    if (relative(webRoot, requested).startsWith('..'))
      return new Response('Not found', { status: 404 });
    const response = await net.fetch(pathToFileURL(requested).toString());
    if (!requested.endsWith('.html')) return response;
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  });
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith(`${APP_ORIGIN}/`) || (!!devUrl && url.startsWith(devUrl));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Fonética RP',
    backgroundColor: '#f6f4ef',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Nada se abre dentro de la app: los enlaces a Longman van al navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${LDOCE_ORIGIN}/`)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`) && !(devUrl && url.startsWith(devUrl)))
      event.preventDefault();
  });

  void mainWindow.loadURL(devUrl ?? `${APP_ORIGIN}/index.html`);
  if (devUrl) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serveAngularBuild();

  const lexicon = new Lexicon();
  lexicon.loadBritfone(
    readFileSync(join(resourcesDir(), 'britfone', 'britfone.main.3.0.1.csv'), 'utf8'),
  );

  const userData = app.getPath('userData');
  ldoceCache = new LdoceCache(join(userData, 'ldoce-cache.json'));
  for (const lookup of ldoceCache.all()) applyLookupToLexicon(lexicon, lookup);

  const ldoce = new LdoceClient(
    (url, init) => net.fetch(url, init),
    ldoceCache,
    new AudioCache(join(userData, 'audio')),
  );
  const voiceModel = join(resourcesDir(), 'piper', 'en_GB-cori-high.onnx');
  const voice = PiperVoice.isInstalled(voiceModel) ? new PiperVoice(voiceModel) : null;
  // Analizador gramatical (spaCy): empaquetado en resources/nlp o, en desarrollo, el Python de nlp/.venv.
  nlp = NlpClient.locate(resourcesDir(), app.getAppPath());
  registerIpc({ lexicon, ldoce, voice, nlp, isTrustedSender });
  createWindow();
});

app.on('before-quit', () => {
  ldoceCache?.flush();
  nlp?.dispose();
});
app.on('window-all-closed', () => app.quit());
