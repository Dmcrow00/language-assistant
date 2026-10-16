# Fonética RP (dmc00-language-assistant)

Reglas del workspace: `dmc00-workspace/CLAUDE.md` (git, commits, Definición de terminado). Acá sólo lo
propio del proyecto.

- La lógica está en el motor Java (`sidecar-java/`, paquete `com.dmc00.fonetica`); Electron sólo valida y
  reenvía (`electron/ipc.ts`). No agregar lógica de negocio en TypeScript del proceso main.
- El contrato con la interfaz es `shared/fonetica-api.ts`: un cambio ahí se refleja en `api/` del motor,
  en `ipc.ts` y en `preload.ts` en el mismo commit (`docs/documentacion-tecnica.md` §3).
- El motor tiene que responder igual que la versión TypeScript que reemplazó: no tocar los JSON de
  `sidecar-java/src/test/resources/paridad/` salvo un cambio de comportamiento a propósito, explicado en
  el commit.
- stdout del motor es del protocolo: nada de `System.out.println`; avisos con `System.Logger`.
- Tests: `npm run test:sidecar`, `npm run test:electron`, `npm test`, `npm run lint`. Si cambia algo
  visible: `node scripts/capturas.mjs`.
- No versionar la voz (`resources/piper/`), el analizador empaquetado (`resources/nlp/`), `release/` ni
  `sidecar-java/target/`. El repo es público.
