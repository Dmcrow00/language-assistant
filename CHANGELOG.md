# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado

- Motor en Java 25 (`sidecar-java/`): léxico y búsquedas, transcripción de oraciones y habla conectada,
  Longman (jsoup, misma caché), voz Piper (ONNX Runtime para Java) y análisis Quirk / Greenbaum. Electron
  lo lanza al iniciar y le habla por stdin/stdout (ADR-0001, ADR-0002 de `dmc00-workspace`).
- Actualización automática de la versión instalada contra GitHub Releases (electron-updater).
- ESLint (`npm run lint`), CI en GitHub Actions (Node + Java 25) y documentación técnica, de entorno y
  despliegue, diagramas y ADR en `docs/`.
- Workflow de release (`release.yml`): con un tag `vX.Y.Z` arma el instalador en Windows y lo publica en
  GitHub Releases con las notas del CHANGELOG (Setup, `.blockmap`, `latest.yml` y portable).
- Capturas de las pantallas principales (`node scripts/capturas.mjs` → `docs/capturas/`).
- Pruebas: los casos de `node:test` portados a JUnit, los 38 ejercicios de gramática con el análisis
  guardado de spaCy (el fixture suma los 16 que faltaban) y paridad con la versión TypeScript.

### Cambiado

- La versión de ONNX Runtime viene de `dmc00-parent` (#5) y el CI y el release compilan contra su `develop`.
- El instalador incluye el motor Java con su propio Java mínimo: pasa de 279,5 MB a 300,6 MB.
- `npm run test:core` pasa a ser `npm run test:sidecar` (motor) y `npm run test:electron` (cliente);
  `npm run dist` ya no publica (`--publish never`).
- Para compilar hace falta JDK 25 (`JAVA_HOME`) y `dmc00-parent` instalado.

### Corregido

- Una oración con la palabra "constructor" ya no da error al transcribirla.

### Eliminado

- El motor TypeScript del proceso main (`electron/core`, `ldoce`, `tts`, `grammar`) y las dependencias
  `onnxruntime-node`, `node-html-parser` y `phonemizer`.
