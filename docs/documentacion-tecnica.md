# Documentación técnica — Fonética RP

Para: quien programa en el proyecto. Responde cómo está armado y cómo se cambia sin romperlo. Versión
0.0.1 (`package.json` y `sidecar-java/pom.xml`).

## 1. Arquitectura

Tres procesos en la PC del alumno ([diagrama de despliegue](diagramas/despliegue.md)):

| Proceso | Tecnología | Qué hace |
|---|---|---|
| Electron (main + renderer) | Electron 44, Angular 21 | La ventana y la interfaz. El proceso main sólo valida y reenvía: no tiene lógica de negocio |
| Motor (`sidecar-java/`) | Java 25, sin Spring | Léxico y búsquedas, oraciones, Longman, voz Piper, análisis Quirk. Lo lanza Electron al iniciar |
| Analizador spaCy (`nlp/nlp_server.py`) | Python 3.12 + spaCy 3.8 | El árbol de dependencias de una oración. Lo lanza el motor la primera vez que se analiza algo |

```
renderer (Angular) ──IPC──▶ Electron main (ipc.ts) ──stdin/stdout, JSON por línea──▶ motor Java ──stdin/stdout──▶ spaCy
```

- **Contrato con la interfaz**: `shared/fonetica-api.ts` (16 canales). Electron atiende dos
  (`shell:open-in-browser`, `window:set-theme`) y reenvía los otros 14 al motor sin transformar la
  respuesta, así el renderer no cambió al pasar el motor a Java (ADR-0002 de `dmc00-workspace`).
- **Validación en dos lados**: `electron/ipc.ts` valida remitente (`app://bundle` o el `ng serve` de
  desarrollo), tipos y largos; `ipc/Input.java` + `ipc/Handlers.java` repiten la misma validación.
- **Protocolo con el motor** ([ADR-0001](decisiones/ADR-0001-protocolo-json-por-linea.md)):
  ```
  al iniciar:  {"ready": true, "version": "0.0.1", "words": 15212, "voice": true, "grammar": true}
  pedido:      {"id": 7, "channel": "lexicon:search-spelling", "args": ["watre", 25]}
  respuesta:   {"id": 7, "result": [...]}     el JSON del contrato
               {"id": 7, "bytes": "UklGR..."} audio (WAV de la voz, MP3 de Longman) en base64
               {"id": 7, "error": "Se esperaba un texto"}
  ```
  Cada pedido se atiende en un hilo virtual; las respuestas pueden llegar en otro orden. Electron espera
  hasta 60 s (`sidecar-client.ts`); si el motor se cae, fallan los pedidos en curso y el próximo lo
  relanza. Cerrar stdin le pide al motor que guarde la caché de Longman, cierre spaCy y termine.
- Secuencia completa de una consulta: [diagramas/secuencias.md](diagramas/secuencias.md).

## 2. Módulos

| Módulo | Responsabilidad | Dónde |
|---|---|---|
| Ventana y puente | Ventana, protocolo `app://`, CSP, preload, validación IPC, arranque del motor | `electron/main.ts`, `preload.ts`, `ipc.ts` |
| Cliente del motor | Lanza el motor (Java del instalador o `JAVA_HOME` en desarrollo) y le habla | `electron/sidecar-client.ts` |
| Actualización | electron-updater contra GitHub Releases (sólo instalador NSIS) | `electron/updater.ts` |
| Contrato | Tipos y canales que comparten interfaz y Electron | `shared/fonetica-api.ts`, `shared/grammar.ts` |
| Arranque del motor | Diccionario, caché, voz, spaCy; composición a mano (sin Spring) | `com.dmc00.fonetica.SidecarMain` |
| Protocolo | Lectura de stdin, un hilo virtual por pedido, escritura de respuestas | `ipc/JsonLineServer` |
| Canales | Los 14 canales, con la validación de la entrada | `ipc/Handlers`, `ipc/Input` |
| Contrato JSON | Las respuestas, con las mismas formas que `shared/fonetica-api.ts` | `api/` |
| Fonemas | Inventario RP en notación Longman, normalización IPA, tokenizador | `core/PhonemeInventory`, `core/Ipa` |
| Transcripciones | Alternativas abreviadas y sonidos opcionales de Longman, Britfone → Longman | `core/Transcription` |
| Búsquedas | Índice Britfone + Longman; ortografía (exacta, prefijo, difusa, "como suena") y fonemas | `core/Lexicon`, `core/Distance` |
| Oraciones | Pausas, formas fuertes y débiles (Roach), r de enlace, palabras derivadas, habla conectada | `core/Sentence`, `core/FunctionWords`, `core/ConnectedSpeech` |
| Estudio | Corrección del dictado, terminaciones -s / -ed | `core/StudyTools` |
| Longman | Parser HTML (jsoup), cliente con cola (1 pedido por segundo), caché JSON + MP3 | `ldoce/` |
| Voz | Notación eSpeak; modelo Piper con ONNX Runtime; WAV 16 bits mono | `tts/EspeakNotation`, `tts/PiperVoice` |
| Gramática | Cliente de spaCy; árbol de dependencias → Quirk / Greenbaum | `grammar/NlpClient`, `grammar/QuirkAnalysis` |

Clases y relaciones: [diagramas/clases.md](diagramas/clases.md).

### Datos

| Qué | Dónde | Formato |
|---|---|---|
| Consultas a Longman | `%APPDATA%\dmc00-language-assistant\ldoce-cache.json` | `{"version":1,"lookups":{"water":{...,"parserVersion":3}}}`; se vuelve a pedir si cambió `LdoceParser.PARSER_VERSION` o pasaron 180 días; se escribe 500 ms después del último cambio, primero a un `.tmp` |
| Audios de Longman | `%APPDATA%\dmc00-language-assistant\audio\<sha1 de la ruta>.mp3` | MP3 tal cual |
| Preferencias | localStorage del renderer (`fonetica-rp:preferencias`) | JSON |
| Diccionario, voz, analizador | `resources/britfone`, `resources/piper`, `resources/nlp` (en el instalador, junto al ejecutable) | sólo lectura |

El formato de la caché es el mismo que escribía la versión TypeScript: las consultas que ya tenían los
usuarios se siguen usando (verificado con una caché real de 48 consultas: mismo léxico y mismas respuestas).

## 3. Cómo agregar un canal

1. `shared/fonetica-api.ts`: el tipo de la respuesta, el método en `FoneticaApi` y el canal en `IPC`.
2. `electron/preload.ts`: el método que hace `invoke`.
3. `electron/ipc.ts`: un `handle` que valida la entrada y la reenvía con `forward` (o la resuelve ahí si
   es algo de la ventana).
4. Motor: el record de la respuesta en `api/` (mismos nombres de campo; opcionales en `null`; los "valor
   o null" del contrato con `@JsonInclude(ALWAYS)`), la lógica en su paquete y el `case` en
   `Handlers.handle`, repitiendo la validación con `Input`.
5. Tests: JUnit de la lógica, un caso en `JsonLineServerTest` (forma del JSON) y el spec de Angular si
   cambia la interfaz.
6. Docs: este archivo, `diagramas/` si cambia un flujo, `CHANGELOG.md`.

## 4. Tests

| Qué | Cómo se corre | Qué necesita |
|---|---|---|
| Motor (JUnit, 121) | `npm run test:sidecar` o `cd sidecar-java && ./mvnw verify` | JDK 25 y `dmc00-parent` instalado. Sin red: Longman se reemplaza por un `Fetcher` falso. Las pruebas con spaCy real y con la voz se saltean si no están instalados |
| Cliente del motor (`node --test`) | `npm run test:electron` | Node 22. Si el motor está compilado (`sidecar-java/target/sidecar`), también prueba el contrato de punta a punta contra el jar real |
| Interfaz (Vitest) | `npm test` | Node 22 |
| Lint | `npm run lint` | — |

Pruebas del motor que vale la pena conocer:

- `CoreTest`, `SentenceTest`, `StudyTest`, `LdoceTest`, `GrammarTest`, `TtsTest`: los casos de
  `node:test` de la versión TypeScript, portados uno por uno (mismos nombres en `@DisplayName`).
- `GrammarTest.ejerciciosConElFixture`: los 38 ejercicios de gramática dan la respuesta escrita a mano,
  con el análisis guardado de spaCy (`spacy-parses.json`, 58 oraciones, spaCy 3.8.16 +
  en_core_web_sm 3.8.0). Si spaCy está instalado, `AnalizadorReal` repite la prueba con el real y
  verifica que el fixture siga al día.
- `ParidadTest`: compara campo por campo las respuestas del motor con las que daba la versión TypeScript
  (`src/test/resources/paridad/`: el léxico completo de Britfone, 129 búsquedas por ortografía, 147 por
  fonemas, 267 oraciones con y sin habla conectada, 125 transcripciones en notación eSpeak, 175 verbos
  (-s, -ed), 45 correcciones de dictado y el análisis
  de las 58 oraciones del fixture). Los generó `electron/test/paridad/generar-paridad.ts` antes de
  borrar el TypeScript (está en la historia de git, commit `9a007b9`). Si un cambio de comportamiento
  es a propósito, se corrige el JSON en el mismo commit y se explica por qué.
- `JsonLineServerTest`: el protocolo, la validación y la forma del JSON (null vs. ausente).
- `study-data.json` es una copia de `shared/study-data` (`npm run export:study-data`); el CI falla si
  quedó desactualizada.

## 5. Definición de terminado

Compila · pasan todos los tests (`test:sidecar`, `test:electron`, `npm test`) · `npm run lint` sin
errores · el código nuevo tiene tests · docs y diagramas actualizados en la misma rama · CHANGELOG en
"Sin publicar" · CI en verde · si cambió algo visible, `node scripts/capturas.mjs` y revisar las capturas.

## 6. Trampas conocidas

- **El motor tiene que dar lo mismo que JavaScript.** `core/JsStrings` reúne lo que en Java se comporta
  distinto: el `\s` y el `trim()` de JavaScript incluyen el espacio duro y otros espacios Unicode; las
  minúsculas siempre con `Locale.ROOT`; `$` de JavaScript es `\z` en Java (el `$` de Java también acepta
  un salto de línea final); `localeCompare` ordena "co-op" antes que "cocoa" y el `Collator` de Java no
  (`JsStrings.LOCALE_ORDER` copia el orden de ICU y lo verifica `ParidadTest.ordenLocaleCompare`).
- **`Set.of(...).contains(null)` lanza excepción** (en JavaScript `set.has(undefined)` es false). Los
  fonemas que pueden faltar (palabra sin transcripción) se chequean antes.
- **`indexOf` = -1 en el grupo verbal**: `QuirkAnalysis.analyzeVerbPhrase` copia a propósito que, para
  un token que no es verbo, el "siguiente verbo" sea el primero (así funcionaba la versión original y las
  respuestas de los ejercicios dependen de eso).
- **jsoup no distingue mayúsculas en las clases** (`hasClass`, selectores); el parser usa una
  comparación exacta (`LdoceParser.hasClass`) donde el original usaba `classList.contains`.
- **stdout es del protocolo.** `SidecarMain` redirige `System.out` a stderr: un `println` olvidado no
  rompe la comunicación, pero los avisos tienen que ir por `System.Logger` (Electron los muestra en su
  consola con el prefijo `[motor]`).
- **El runtime de jlink necesita `java.xml`** aunque el motor no lo use: Jackson 3 lo carga al iniciar.
  `npm run build:sidecar` le hace pedidos de prueba al motor armado con su propio Java para detectar un
  módulo faltante (sin eso, el motor arranca pero no responde).
- **ONNX Runtime**: el jar de Maven trae las librerías nativas de todas las plataformas (55 MB). El jar
  único las excluye y `native/` tiene sólo las de Windows x64; `SidecarMain` apunta
  `onnxruntime.native.path` ahí. En los tests se usan las del jar de Maven.
- **package-lock.json y la versión de npm.** El lock lo escribe npm 11.6 (`packageManager` de
  `package.json`). El npm 10 que trae Node 22 pide además, en el lock, las peer dependencies opcionales de
  `@napi-rs/wasm-runtime` (`@emnapi/*`) y npm 11 las borra al reescribirlo. Por eso el CI y el release
  instalan primero el npm de `packageManager`. Si alguien tiene que usar npm 10, el lock se regenera con
  `npx npm@10 install --package-lock-only` (lo aceptan los dos).
- **Un `.cmd` desde Node 20+** necesita `shell: true` (y la ruta completa entre comillas): ver
  `scripts/mvnw.mjs`.
- **"constructor"**: la versión TypeScript fallaba con cualquier oración que tuviera esa palabra
  (buscaba en el prototipo de `Object`). El motor Java no tiene ese error (`StudyTest.constructorNoRompe`).
- **La caché de Longman de versiones viejas del parser** se carga igual en el léxico al iniciar (como
  antes), pero `ldoce:lookup` la vuelve a pedir a Longman.
