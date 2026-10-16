import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Actualización automática contra GitHub Releases (ADR-0006 de dmc00-workspace; el repo es público, no
 * hace falta token). Al iniciar se fija si hay una versión más nueva publicada; si la hay, la baja en
 * segundo plano, avisa con una notificación de Windows y la instala al cerrar la app.
 *
 * - Sólo en el instalador (NSIS): la versión portable y el modo desarrollo no se actualizan solos.
 * - Sin conexión o sin releases publicadas no pasa nada: el error queda en la consola.
 * La configuración (owner/repo) está en "build.publish" de package.json; electron-builder la copia a
 * resources/app-update.yml.
 */
export function checkForUpdates(): void {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  autoUpdater.checkForUpdatesAndNotify().catch((error: Error) => {
    console.warn(`[actualización] ${error.message}`);
  });
}
