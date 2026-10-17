# Guía de entorno local y despliegue — Fonética RP

Para: quien instala el proyecto en una PC nueva o publica una versión. Los pasos de "primera vez" y la
tabla de comandos están en el [README](../README.md#compilación); acá van las versiones, cómo se arma el
instalador y cómo se publica.

## 1. Entorno local

| Herramienta | Versión | Para qué |
|---|---|---|
| Windows | 10 u 11, 64 bits | la app y su instalador son sólo para Windows |
| Node.js | 22.12 o superior | Angular, Electron, scripts |
| JDK | 25 (Temurin u otro), en `JAVA_HOME` | compilar y correr el motor Java; jlink para el instalador |
| Maven | no se instala: `sidecar-java/mvnw` (Maven 3.9.16) | build del motor |
| dmc00-parent | `develop` (0.1.0-SNAPSHOT) instalado en `~/.m2` | POM padre: versiones de Jackson, jsoup, JUnit… |
| Python | 3.12 en el PATH | sólo para `npm run build:nlp` (spaCy empaquetado con PyInstaller) |

Pasos para el motor Java en una PC nueva:

```bash
git clone https://github.com/Dmcrow00/dmc00-parent.git ../dmc00-parent
cd ../dmc00-parent && ./mvnw install -N && cd -
npm run build:sidecar
npm run test:sidecar
```

En esta máquina el `java` del PATH es un Java 8: el motor siempre usa el de `JAVA_HOME` en desarrollo y
el suyo propio (`resources/sidecar/runtime`) en el instalador.

No hay variables de entorno de la app ni `.env`: no usa claves ni servicios con cuenta.

### Versiones fijadas

| Pieza | Versión | Dónde se fija |
|---|---|---|
| Electron | 44.7 | `package.json` |
| Angular | 21.2 | `package.json` |
| electron-updater | 6.8 | `package.json` |
| Java | 25 | `dmc00-parent` |
| Jackson | 3.1 (por Spring Boot 4.1.1) | `dmc00-parent` |
| jsoup | 1.23.2 | `dmc00-parent` |
| ONNX Runtime para Java | 1.30.0 | `sidecar-java/pom.xml` hasta que se mergee dmc00-parent#5; después, `dmc00-parent` |
| spaCy / en_core_web_sm | 3.8 / 3.8.0 | `nlp/requirements.lock.txt` |
| Voz Piper "Cori" | en_GB-cori-high | `scripts/fetch-voice.mjs` (con MD5) |

## 2. Cómo se arma el instalador

`npm run dist` hace, en orden:

1. `fetch-voice`: baja la voz a `resources/piper/` si falta.
2. `build:nlp`: arma spaCy con PyInstaller en `resources/nlp/` si falta o cambió.
3. `build:sidecar`: `mvnw package -Pempaquetado` deja en `sidecar-java/target/sidecar/`
   ([ADR-0002](decisiones/ADR-0002-empaquetado-del-motor-java.md)):
   - `fonetica-sidecar.jar`: el motor con sus dependencias (maven-shade), sin las nativas de ONNX;
   - `native/`: `onnxruntime.dll`, `onnxruntime4j_jni.dll` y `onnxruntime_providers_shared.dll` de Windows x64;
   - `runtime/`: el Java mínimo (jlink con `java.base`, `java.logging`, `java.net.http`, `java.xml`).
   Después le hace pedidos de prueba al motor con ese Java (diccionario, oración, caché, voz).
4. `build`: Angular y el TypeScript de Electron.
5. `electron-builder --win --publish never`: instalador NSIS y portable en `release/`, con
   `resources/{britfone,piper,nlp,sidecar}` como `extraResources`, más `latest.yml` y el `.blockmap`
   (lo que usa la actualización). No sube nada a GitHub.

### Tamaño

Medido en la misma máquina el 2026-10-16:

| | Antes (motor TypeScript) | Después (motor Java) | Diferencia |
|---|---|---|---|
| `FoneticaRP-Setup-0.0.1.exe` | 279,46 MB | 300,56 MB | +21,1 MB (+7,5 %) |
| `FoneticaRP-Portable-0.0.1.exe` | 279,23 MB | 300,33 MB | +21,1 MB |
| Instalada (`win-unpacked`) | 703 MB | 728 MB | +25 MB |

La carpeta `sidecar/` ocupa 55 MB (runtime 36, nativas 16, jar 3,4); a cambio salieron
`onnxruntime-node` (~30 MB) y `node-html-parser` del `app.asar`. Lo más pesado sigue siendo spaCy
(195 MB) y la voz (109 MB).

## 3. Actualización automática

- Librería: `electron-updater`, provider `github`, repo público `Dmcrow00/language-assistant` (no hace
  falta token). La configuración está en `build.publish` de `package.json`; electron-builder la copia a
  `resources/app-update.yml`.
- Comportamiento (`electron/updater.ts`): al abrir la app instalada consulta la última release; si hay
  una versión mayor la baja en segundo plano, muestra una notificación de Windows y la instala al cerrar.
  Sin conexión o sin releases no hace nada (queda un aviso en la consola). La versión portable y el modo
  desarrollo no se actualizan.
- Integridad: electron-updater verifica el SHA-512 que figura en `latest.yml`. El instalador no está
  firmado (SmartScreen avisa al instalar, igual que antes).
- Para que funcione hay que publicar en cada release **los tres archivos**: `FoneticaRP-Setup-x.y.z.exe`,
  `FoneticaRP-Setup-x.y.z.exe.blockmap` y `latest.yml`. La portable se puede agregar para quien la use.

## 4. Publicar una versión

Pasos comunes en `dmc00-workspace/docs/convenciones/git-y-versionado.md` §6. En este proyecto:

1. Rama `r.ceballos/CHORE_versionX.Y.Z` desde `develop`: subir la versión en `package.json`
   (`npm version X.Y.Z --no-git-tag-version`) **y** en `sidecar-java/pom.xml`
   (`cd sidecar-java && ./mvnw versions:set -DnewVersion=X.Y.Z -DgenerateBackupPoms=false`);
   pasar "Sin publicar" del CHANGELOG a `[X.Y.Z] - fecha`. PR a `develop`.
2. **El dueño**: merge a `main`, tag anotado `vX.Y.Z` y `git push --follow-tags`.
3. El push del tag dispara `.github/workflows/release.yml` (Windows, ~30 min la primera vez):
   - verifica que el tag sea la versión de `package.json` y de `sidecar-java/pom.xml`;
   - corre los tests de la interfaz y del motor;
   - `npm run dist`, con caché de la voz (`resources/piper`) y de spaCy empaquetado (`resources/nlp`, se
     rearma si cambian `nlp/nlp_server.py`, `nlp/requirements.lock.txt` o `scripts/build-nlp.mjs`);
   - crea la release en este repo con las notas de `## [X.Y.Z]` del CHANGELOG y adjunta
     `FoneticaRP-Setup-X.Y.Z.exe`, su `.blockmap`, `latest.yml` y la portable. Un tag con guion
     (`v1.2.0-beta.1`) sale como *pre-release* y electron-updater no la ofrece.
   Los instaladores ya instalados la detectan la próxima vez que se abran.

Para probar el workflow sin publicar: **Actions → Release → Run workflow** sobre una rama. Arma todo y
deja los archivos como artefacto de la ejecución (7 días), con las notas de "Sin publicar".

Necesita el secret `CROSS_REPO_PAT` (lectura de `dmc00-parent`) mientras ese repo sea privado; la release
la crea el `GITHUB_TOKEN` del workflow. Si hace falta publicar a mano (por ejemplo, sin Actions), en una PC
con el entorno armado y en `main`:

```bash
npm run dist
```

```bash
gh release create vX.Y.Z --title "Fonética RP X.Y.Z" --notes-file notas.md release/FoneticaRP-Setup-X.Y.Z.exe release/FoneticaRP-Setup-X.Y.Z.exe.blockmap release/latest.yml release/FoneticaRP-Portable-X.Y.Z.exe
```

## 5. Rollback

- Una release mala: marcarla como *pre-release* o borrarla en GitHub hace que electron-updater vuelva a
  ver la anterior como "última" (no baja de versión a quien ya actualizó: para eso hay que publicar una
  versión nueva con el arreglo, X.Y.Z+1).
- La caché de Longman no cambia de formato con el motor Java; si un cambio del parser la invalida, se sube
  `LdoceParser.PARSER_VERSION` y las consultas se vuelven a pedir solas. Borrar
  `%APPDATA%\dmc00-language-assistant` deja la app como recién instalada.
