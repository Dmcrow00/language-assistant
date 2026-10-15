import type { FoneticaApi } from '../../shared/fonetica-api';

declare global {
  interface Window {
    /** Lo expone electron/preload.ts. No existe si la interfaz se abre en un navegador común. */
    fonetica?: FoneticaApi;
  }
}

export {};
