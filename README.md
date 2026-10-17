# Fonética RP

Repositorio: https://github.com/Dmcrow00/language-assistant (carpeta local `dmc00-language-assistant`).
Ramas: `main` (versiones estables) y `develop` (desarrollo de nuevas funciones).

Aplicación de escritorio (Windows) para estudiar la fonética del inglés británico (Received
Pronunciation) y la gramática del inglés en el profesorado. Tiene dos menús:

- **Fonética**: buscar una palabra (transcripción y audio de Longman), teclado fonético para
  escribir cómo suena una palabra, transcripción de oraciones con formas débiles y fuertes y
  habla conectada, dictado fonético y pares mínimos.
- **Gramática** (Quirk / Greenbaum): análisis de oraciones (SVOCA, tipos de cláusula, frases y
  subordinadas), grupo verbal, verbos irregulares y ejercicios de análisis.

Contenido: [Instalación](#instalación) · [Uso](#uso) · [Compilación](#compilación) ·
[Cómo está armada](#cómo-está-armada) · [Documentación técnica](docs/README.md) · [CHANGELOG](CHANGELOG.md)

## Instalación

Para alumnos y docentes que sólo quieren usar la aplicación.

**Requisitos**: Windows 10 u 11 de 64 bits y unos 750 MB libres. Hace falta conexión a internet
sólo para consultar en Longman palabras que todavía no se buscaron; lo ya consultado, la voz
británica, el análisis gramatical y las prácticas funcionan sin conexión.

Hay dos versiones; las dos hacen lo mismo:

| Archivo | Cuándo usarlo |
| --- | --- |
| `FoneticaRP-Setup-x.y.z.exe` | Instalador. Queda en el menú Inicio y abre más rápido. Recomendado para la computadora personal. |
| `FoneticaRP-Portable-x.y.z.exe` | No se instala: se abre con doble clic desde cualquier carpeta o pendrive. Tarda unos segundos más en abrir porque se descomprime cada vez. Útil en computadoras de laboratorio. |

Las versiones publicadas están en
[GitHub Releases](https://github.com/Dmcrow00/language-assistant/releases) (las arma el workflow de
release al crear un tag). También se pueden generar con `npm run dist` (ver
[Compilación](#compilación)) y compartir por el campus o una carpeta en la nube.

### Con el instalador

1. Doble clic en `FoneticaRP-Setup-x.y.z.exe`.
2. Windows puede mostrar «Windows protegió su PC» porque el ejecutable no tiene firma digital:
   elegir **Más información → Ejecutar de todas formas**.
3. Elegir la carpeta de instalación (se instala para el usuario actual, sin permisos de
   administrador) y terminar. Quedan accesos directos en el escritorio y en el menú Inicio.

Para desinstalar: **Configuración de Windows → Aplicaciones → Fonética RP → Desinstalar**.

La versión instalada se actualiza sola: al abrirla se fija si hay una versión nueva publicada en
GitHub, la baja en segundo plano, avisa con una notificación y la instala al cerrar la aplicación.

### Con la versión portable

Copiar `FoneticaRP-Portable-x.y.z.exe` donde se quiera y abrirlo con doble clic (la primera vez
puede aparecer el mismo aviso de Windows). Para quitarla alcanza con borrar el archivo. La versión
portable no se actualiza sola: hay que bajar la nueva.

### Datos que guarda

Las palabras ya consultadas en Longman y sus audios quedan en `%APPDATA%\dmc00-language-assistant`
(así funcionan sin conexión la próxima vez), junto con las preferencias (tema, tamaño de letra,
audio lento). Borrar esa carpeta deja la aplicación como recién instalada.

## Uso

**Generalidades**

- Al abrir aparece **Inicio**: «¿Qué querés hacer hoy?», con las herramientas para **Consultar**
  y las de **Practicar**, **Seguí donde dejaste** (la última pantalla usada) y el **Sonido del
  día**. La primera vez muestra una bienvenida corta, que se puede volver a ver desde **Ayuda**.
- El menú de la izquierda tiene las secciones **Fonética** y **Gramática**; las prácticas llevan la
  etiqueta *Práctica*. Abajo están **Ayuda** (cómo leer una transcripción, etiquetas, atajos y el
  glosario completo) y **Acerca de la app** (fuentes, créditos y cuántas palabras hay guardadas).
  Cada pantalla conserva lo escrito al cambiar de una a otra.
- Cada pantalla empieza con su título, para qué sirve y un **Paso a paso** de tres pasos. Se
  muestra abierto mientras la herramienta es nueva; después arranca plegado, salvo que se lo deje
  abierto.
- Los términos de la materia llevan un **?** al lado: al tocarlo se abre su explicación (se cierra
  con **Esc** o tocando afuera).
- Arriba a la derecha: **Audio lento** (todos los audios más despacio, sin cambiar el tono),
  **Letra A− / A+** (tamaño del texto, útil para proyectar en clase) y **Tema** claro, oscuro o
  automático (el de Windows). La aplicación recuerda estas preferencias.
- Etiquetas de las pronunciaciones: **Confirmada** = coincide con el diccionario Longman;
  **Estimada** = sale del diccionario incluido en la app y se confirma al abrir la palabra con
  internet; **Por regla** = armada a partir de otra palabra (*watered* ← *water* + -ed).
- La primera vez que se usa la voz de la app tarda alrededor de un segundo, y el primer análisis
  gramatical, uno o dos; después es instantáneo.
- Cada palabra nueva se confirma con Longman (como máximo una por segundo) y queda guardada.

### Fonética → Buscar palabra

Pronunciación británica y americana de una palabra, con audio.

1. Escribir la palabra con su ortografía normal, aunque sea con errores («thougt», «recieve»): la
   lista muestra palabras parecidas con su transcripción. Sin nada escrito aparecen ejemplos para
   probar.
2. Elegir con clic, o moverse con **↑ ↓** y confirmar con **Enter**. Enter sin elegir nada busca en
   el diccionario lo escrito tal cual; si no existe, sugiere alternativas («¿Quisiste decir…?»).
3. La ficha muestra la transcripción británica (RP) y la americana, cada una con **Escuchar**; las
   formas débil y fuerte si las tiene; **Sonido por sonido** (cada símbolo con una palabra de
   ejemplo que se escucha al tocarlo); una definición corta para distinguir homófonos y **Ver en el
   diccionario**.

**Esc** borra la búsqueda.

### Fonética → Teclado fonético

Escribir cómo suena una palabra y encontrar cuál es.

1. Tocar los símbolos en el teclado (ordenado como la tabla fonémica de Underhill). Los diptongos
   y las africadas son una sola tecla; **ˈ** y **ˌ** marcan el acento. Sin nada escrito aparecen
   ejemplos para probar (/kæt/, /ʃiːp/…).
2. Los resultados se actualizan solos: **Suena exactamente así** (homófonos) y **Lo más parecido**,
   comparado sonido por sonido: verde = coincide, naranja = cambia (en chiquito, lo que se
   escribió), rojo subrayado = falta, tachado = sobra.
3. Clic en una palabra: su ficha con audio.
4. **Escuchar lo que escribí**: la voz de la app pronuncia exactamente lo escrito, para comparar con
   la palabra real.
5. **Clic derecho** sobre una tecla: se escucha la palabra de ejemplo de ese sonido.
6. **Tener en cuenta el acento**: si se marca el acento en otra sílaba, la palabra queda más lejos.

Con el teclado de la computadora: **Retroceso** borra el último símbolo y **Esc** borra todo.

### Fonética → Transcribir oración

Transcripción de una oración completa, con formas débiles y fuertes.

1. Escribir la oración (o elegir un ejemplo) y apretar **Enter** (**Shift + Enter** para cambiar de
   renglón). La transcripción aparece enseguida y se va confirmando con el diccionario
   («Confirmando la pronunciación (3 de 9)…»).
2. Cada palabra muestra su transcripción: violeta = palabra gramatical (*function word*) en forma
   **débil**, naranja = forma **fuerte**, *r* azul = r de enlace, borde punteado = pronunciación
   estimada o formada por regla.
3. **Clic** en una palabra: su ficha y, si es una palabra gramatical, por qué lleva esa forma y un
   botón para enfatizarla (forma fuerte) o quitarle el énfasis; la transcripción y la voz cambian.
   **Doble clic**: escucharla.
4. **Habla conectada** (activada): formas débiles y r de enlace; desactivada, cada palabra en su
   forma de cita. **Mostrar los procesos**: marca además asimilación (*ten boys* /tem/), elisión
   (*next day* /neks/), coalescencia (*don't you* /dəʊntʃu/) y r intrusiva (*idea of*), con la lista
   de los procesos debajo.
5. **Escuchar la oración**: la voz de la app la lee tal como está transcripta. **Palabra por
   palabra**: encadena las grabaciones del diccionario (cada palabra dicha sola).
6. **Copiar**: copia la transcripción completa (con | para pausas cortas y || para fin de oración).

### Fonética → Dictado

1. Elegir el **Nivel** (vocales y diptongos, consonantes, ortografía engañosa, polisílabos y
   acento, frases con formas débiles) y apretar **Empezar**.
2. Escuchar (**Escuchar de nuevo** las veces que haga falta) y escribir con el teclado en pantalla;
   **Retroceso** borra el último símbolo.
3. **Enter** (o **Comprobar**). Si no está bien, primero llega una **pista**: se marcan en naranja
   los símbolos para revisar (y dónde falta uno) y se dice cuántos sonidos tiene, sin mostrar la
   respuesta. Se corrige y se vuelve a comprobar; si sigue sin salir, o con **Ver la respuesta**, se
   muestra la transcripción correcta comparada sonido por sonido. **Enter** pasa a la siguiente;
   **Pasar a otra** cambia de palabra sin contarla.

Arriba se ven los aciertos de la sesión y abajo, **Para repasar**: los sonidos que más costaron. No
se tiene en cuenta el acento. Las palabras usan la grabación y la transcripción de Longman.

### Fonética → Pares mínimos

1. Elegir los sonidos a la izquierda (/iː/–/ɪ/, /b/–/v/, /s/–/θ/…); arriba se explica por qué
   cuestan.
2. **Escuchar** y elegir cuál de las dos palabras sonó.
3. La respuesta dice qué sonido lleva la palabra (««sheep» lleva /iː/»), muestra las dos
   transcripciones y permite escuchar cada una.

**Usar sólo la voz de la app** reemplaza las grabaciones de Longman (sirve sin internet).

### Gramática → Analizar oración

Análisis según Quirk / Greenbaum.

1. Escribir una o más oraciones (o hacer clic en un ejemplo) y apretar **Enter** o **Analizar**.
   Después del primer análisis los ejemplos quedan en **Ver ejemplos**.
2. Arriba de cada oración: si es simple, compuesta, compleja o compuesta-compleja, su forma
   (declarativa, interrogativa…) y cuántas subordinadas tiene.
3. Cada cláusula aparece como una fila de elementos con su color (S, V, Od, Oi, Cs, Co, A), la forma
   de cada uno (NP, VP, AdjP, AdvP, PP o cláusula) y el tipo de cláusula (SV, SVO, SVC, SVA, SVOO,
   SVOC, SVOA). **A\*** = adverbial obligatorio; borde punteado = adverbial opcional.
4. **Clic** en un elemento: su estructura (determinante, premodificador, núcleo, posmodificador) y,
   si es o contiene una cláusula (relativa, adverbial, no finita…), su análisis completo, que a su
   vez se puede desplegar.
5. **Clases de palabras** muestra la clase de cada palabra; al final están los grupos verbales.
6. A la derecha hay referencias: los elementos, los siete tipos de cláusula (clic en un ejemplo lo
   analiza) y las frases.

La pantalla lo aclara: el análisis lo hace la computadora y puede equivocarse, así que conviene
compararlo con el propio y con el criterio de la cátedra.

### Gramática → Grupo verbal

Escribir una o más oraciones (o hacer clic en un ejemplo): cada grupo verbal aparece desarmado en
sus partes (modal, auxiliar de perfecto, de progresivo, de pasiva, verbo léxico) con su nombre en
inglés (*present perfect progressive passive*) y la explicación. A la derecha están las
combinaciones de auxiliares y las formas no finitas.

### Gramática → Verbos irregulares

- **Tabla**: buscar por verbo o significado, filtrar por patrón (cut-cut-cut, keep-kept-kept,
  come-came-come, go-went-gone) y hacer clic en una forma para escucharla.
- **Práctica**: **Empezar** muestra un verbo (de la lista filtrada); escribir el pasado y el
  participio, **Enter** comprueba y **Enter** de nuevo pasa al siguiente. Se aceptan las variantes
  (*learnt* o *learned*).
- **Pronunciación de -s y -ed**: escribir un verbo regular (o elegir un ejemplo) para ver cómo
  suenan sus terminaciones (/s/ /z/ /ɪz/, /t/ /d/ /ɪd/) y la regla que lo explica.

### Gramática → Ejercicios

1. Marcar la función de cada parte con los botones **S V Od Oi Cs Co A** (arriba está qué significa
   cada uno). Lo que aparece en gris es contexto y no se analiza; si el verbo aparece en dos pedazos
   (*Did … send*), los dos son **V**.
2. Elegir **cómo es el sujeto**: expreso, implícito (imperativas) o elíptico (coordinadas).
3. Elegir el **tipo de cláusula** y apretar **Comprobar**. Si hay errores, se marca en naranja qué
   revisar, sin dar la respuesta, y hay un segundo intento. Después (o con **Ver la respuesta**)
   cada parte se pinta de verde o rojo, con la función correcta y la explicación. **Siguiente**
   pasa a otro ejercicio.

Los 38 ejercicios salen en orden aleatorio y arriba se lleva la cuenta de aciertos.

### Si algo no funciona

| Qué pasa | Qué hacer |
| --- | --- |
| La aplicación no abre | Puede estar abierta (sólo se permite una ventana): buscarla en la barra de tareas. |
| «Sin internet: estás viendo una pronunciación estimada» | No hay conexión. Lo ya buscado sigue disponible; para lo demás se muestra la pronunciación estimada y se puede escuchar con la voz de la app. |
| No se oye nada | Revisar el volumen de Windows. La primera lectura de la voz de la app tarda un segundo. |
| «El análisis de oraciones no está disponible en esta computadora» o no aparece la voz de la app | Sólo pasa en una copia de desarrollo armada sin `npm run build:nlp` o sin `npm run fetch-voice`. |

## Compilación

Para quien vaya a modificar la aplicación o generar el instalador. El detalle técnico (arquitectura,
protocolo con el motor, tests, trampas) está en [docs/](docs/README.md).

**Requisitos**

- Windows 10 u 11 de 64 bits, con unos 3 GB libres (dependencias, entorno de Python y ejecutables).
- [Git](https://git-scm.com/) y [Node.js](https://nodejs.org/) 22.12 o superior (incluye npm).
- [JDK 25](https://adoptium.net/) con la variable `JAVA_HOME` apuntando a él: el motor está en Java
  (`sidecar-java/`). No hace falta instalar Maven: se usa el wrapper `mvnw` del proyecto.
- `dmc00-parent` (el POM padre de los proyectos Java del workspace) instalado en el repositorio Maven
  local: `cd dmc00-parent && ./mvnw install -N` (ver [la guía](docs/guia-entorno-local-y-despliegue.md)).
- [Python](https://www.python.org/) 3.12 en el PATH, sólo para armar el analizador gramatical.
- Conexión a internet la primera vez: paquetes de npm y de Maven, la voz británica (114 MB, de
  Hugging Face) y los paquetes de Python (spaCy, su modelo y PyInstaller, unos 60 MB).

**Primera vez**

```bash
git clone https://github.com/Dmcrow00/language-assistant.git
cd language-assistant
git checkout develop
npm install
npm run fetch-voice
npm run build:nlp
npm start
```

- `npm run fetch-voice` baja la voz a `resources/piper/` y verifica su suma de control.
- `npm run build:nlp` crea el entorno `nlp/.venv`, instala las versiones fijadas en
  `nlp/requirements.lock.txt` y arma el analizador en `resources/nlp/` (la primera vez tarda unos
  minutos; después sólo se rearma si cambió `nlp/nlp_server.py`).
- `npm start` compila la interfaz, Electron y el motor Java (`npm run build:sidecar`) y abre la
  aplicación.

Sin la voz o sin el analizador la aplicación funciona igual, pero sin voz británica o sin análisis
gramatical. Sin el motor Java compilado la interfaz abre pero no responde (la consola avisa
«npm run build:sidecar»).

**Durante el desarrollo**

- `npm run dev` abre la aplicación con recarga automática de la interfaz (los cambios en
  `electron/` o en `sidecar-java/` requieren cerrarla y volver a abrirla; `npm run dev` rearma el
  motor si cambió).
- `npm run test:sidecar` (motor Java), `npm run test:electron` (cliente del motor) y `npm test`
  (interfaz) corren las pruebas; `npm run lint` revisa el TypeScript y las plantillas.
- Los cambios nuevos se hacen en ramas que salen de `develop` y pasan a `main` cuando forman una
  versión estable (ver `dmc00-workspace/docs/convenciones/git-y-versionado.md`).

**Generar el instalador**

1. Si es una versión nueva, actualizar la versión en `package.json` **y** en `sidecar-java/pom.xml`
   (tienen que coincidir: `npm run build:sidecar` lo verifica).
2. Cerrar la aplicación si está abierta (Windows no deja reemplazar el ejecutable en uso).
3. Correr `npm run dist`: compila todo, baja la voz y arma el analizador si faltan, arma el motor con
   su Java mínimo (jlink) y deja en `release/` el instalador, la versión portable y `latest.yml`
   (lo que lee la actualización automática). No publica nada en GitHub.

### Comandos

| Comando | Para qué |
| --- | --- |
| `npm install` | Instala dependencias (incluye el binario de Electron). |
| `npm run fetch-voice` | Baja la voz británica (114 MB) a `resources/piper/` y verifica su MD5. `npm run dist` la baja sola si falta. |
| `npm run build:nlp` | Arma el analizador gramatical (spaCy) como ejecutable en `resources/nlp/`. Con `-- --force` lo rearma siempre. `npm run dist` lo arma solo si falta. |
| `npm run build:sidecar` | Arma el motor Java en `sidecar-java/target/sidecar/` (jar, librerías nativas de ONNX Runtime y Java mínimo con jlink) y le hace unos pedidos de prueba. Sólo si cambió algo; con `-- --force`, siempre. |
| `npm start` | Compila todo y abre la aplicación. |
| `npm run dev` | Desarrollo: `ng serve` con recarga automática + Electron apuntando a él. |
| `npm run test:sidecar` | Pruebas del motor Java (JUnit): búsquedas, transcripciones, Longman (sin red), oraciones, voz, gramática, protocolo y paridad con la versión TypeScript. |
| `npm run test:electron` | Pruebas del cliente del motor (`node --test`); si el motor está compilado, también de punta a punta. |
| `npm test` | Pruebas de la interfaz (Vitest). |
| `npm run lint` | ESLint (TypeScript de Electron, código compartido, scripts e interfaz Angular). |
| `npm run export:study-data` | Copia el material de estudio de `shared/study-data` a JSON para los tests del motor (el CI verifica que esté al día). |
| `npm run dist` | Genera en `release/` el instalador (`FoneticaRP-Setup-x.y.z.exe`) y la versión portable (`FoneticaRP-Portable-x.y.z.exe`), con la voz, el analizador y el motor incluidos. |
| `node scripts/capturas.mjs` | Abre la app y guarda una captura de cada pantalla en `docs/capturas/` (después de `npm run build` y `npm run build:sidecar`). |

### Problemas al compilar

| Qué pasa | Qué hacer |
| --- | --- |
| Electron no arranca después de `npm install` porque falta su binario | `node node_modules/electron/install.js` |
| `npm run build:nlp` dice que no encuentra `python` | Instalar Python 3.12 y marcar «Add python.exe to PATH»; abrir una terminal nueva. |
| `npm run build:sidecar` dice que el JDK es viejo, o `java` es la versión 8 | Instalar el JDK 25 y apuntar `JAVA_HOME` a él (el `java` del PATH no se usa). |
| `npm run build:sidecar` no encuentra `com.dmc00:dmc00-parent` | Instalar el POM padre: `cd ../dmc00-parent && ./mvnw install -N`. |
| `npm run dist` falla porque un archivo está en uso | Cerrar la aplicación (instalada o portable) y repetir. |
| `npm start` o `npm run dev` no abren ninguna ventana | Ya hay otra instancia abierta (también la instalada): cerrarla. |

## Cómo está armada

La interfaz (Angular) corre dentro de Electron; toda la lógica corre en un **motor Java** aparte
(`sidecar-java/`) que Electron lanza al iniciar y con el que habla por stdin/stdout, una línea JSON
por pedido. El análisis sintáctico lo hace spaCy (Python), otro proceso que lanza el motor. Ver
[docs/documentacion-tecnica.md](docs/documentacion-tecnica.md) y los
[diagramas](docs/diagramas/secuencias.md).

```
electron/                 Proceso principal de Electron: ventana y puente con el motor
  main.ts                 Ventana, protocolo app:// para servir la interfaz, arranque del motor
  preload.ts              Puente seguro: expone window.fonetica a la interfaz
  ipc.ts                  Handlers IPC: valida todo lo que llega de la interfaz y lo reenvía al motor
  sidecar-client.ts       Lanza el motor Java y le habla (JSON por línea, id, timeout, reinicio)
  updater.ts              Actualización automática contra GitHub Releases (electron-updater)
  test/                   Pruebas del cliente (con un motor falso y contra el motor real)
sidecar-java/             Motor (Java 25, Maven sobre dmc00-parent) — paquete com.dmc00.fonetica
  SidecarMain.java        Arranque: diccionario, caché de Longman, voz, spaCy; atiende pedidos
  ipc/                    Protocolo JSON por línea y los 14 canales (Handlers), con su validación
  api/                    El contrato JSON (mismas formas que shared/fonetica-api.ts)
  core/                   Fonemas, transcripciones de Longman, distancias, léxico y búsquedas,
                          oraciones, formas fuertes y débiles, habla conectada, dictado, -s / -ed
  ldoce/                  Longman: lectura del HTML con jsoup, cliente (1 consulta por segundo), caché
  tts/                    Voz británica: notación eSpeak y modelo de Piper con ONNX Runtime
  grammar/                Cliente de spaCy y análisis de Quirk / Greenbaum
  src/test/               Pruebas JUnit, fixture de spaCy y datos de paridad con la versión TypeScript
shared/                   Código común a Electron y la interfaz
  fonetica-api.ts         Contrato entre interfaz y motor (tipos y canales IPC)
  phoneme-inventory.ts    Inventario de fonemas RP con palabras de ejemplo
  grammar.ts              Tipos del análisis gramatical (SVOCA, frases, cláusulas, grupo verbal)
  study-data/             Material de estudio: verbos irregulares, ejercicios, dictado, pares mínimos
src/app/                  Interfaz (Angular 21, componentes standalone y signals)
  app.ts                  Marco: menú lateral, barra superior (audio lento, letra, tema) y pantallas
  core/navigation.ts      Pantallas de cada sección con su título, objetivo y paso a paso
  core/preferences.service.ts  Tema, tamaño de letra, audio lento y estado de las guías (guardados)
  features/home/          Inicio: consultar o practicar, seguí donde dejaste, sonido del día
  features/help/          Ayuda: cómo leer una transcripción, etiquetas, atajos y glosario
  features/about/         Acerca de la app: fuentes y créditos
  features/phonetics/     Buscar palabra, teclado, oración, dictado, pares mínimos
  features/grammar/       Análisis de oraciones, grupo verbal, verbos irregulares, ejercicios
  shared/word-detail/     Ficha de la palabra con audio y sonido por sonido (la usan varias pantallas)
  shared/glossary.ts      Glosario de la materia; shared/term.ts muestra el «?» de cada término
src/styles.css            Colores (claro y oscuro con light-dark()), tipografías y piezas comunes
public/theme-init.js      Aplica el tema guardado antes de dibujar la interfaz
nlp/nlp_server.py         Analizador spaCy (Python): devuelve el árbol de dependencias
nlp/requirements.lock.txt Versiones fijadas de spaCy, el modelo y PyInstaller
resources/britfone/       Diccionario abierto Britfone (MIT) que se empaqueta con la app
resources/piper/          Voz británica (se baja con npm run fetch-voice; no va al repositorio)
resources/nlp/            Analizador empaquetado (se arma con npm run build:nlp; no va al repositorio)
scripts/                  fetch-voice, build-nlp, build-sidecar, mvnw, export-study-data, capturas
docs/                     Documentación técnica, guía de entorno y despliegue, diagramas, ADR, capturas
```

### De dónde salen las transcripciones

- **Longman Dictionary of Contemporary English Online** (ldoceonline.com) es la referencia.
  Longman no tiene una API pública, así que la app lee la misma página que vería el alumno en
  el navegador, **sólo cuando el alumno consulta una palabra**: una consulta por vez, como mínimo
  un segundo entre consultas y todo queda guardado en caché (cada palabra se pide una sola vez y
  después funciona sin conexión). Nunca se recorre el diccionario entero.
- **Britfone** (inglés británico, ~16 000 palabras, licencia MIT) es el índice local. Hace falta
  porque Longman sólo permite buscar por ortografía: para encontrar «qué palabras suenan /nəʊ/»
  hay que tener las transcripciones en el equipo. Al cargarlo se convierte a la notación de
  Longman (/e/, /ʌ/, /r/, /eə/ y el acento antes de la sílaba). Cada palabra que se consulta en
  Longman reemplaza su transcripción de Britfone por la de Longman, así que el índice mejora con
  el uso. En la interfaz se distinguen con la etiqueta «Longman» o «aprox.».

La caché queda en `%APPDATA%\dmc00-language-assistant` (`ldoce-cache.json` y la carpeta `audio`).

### Formas fuertes y débiles en la oración

Las reglas siguen a Roach (*English Phonetics and Phonology*, cap. 12) y están en
`sidecar-java/src/main/java/com/dmc00/fonetica/core/FunctionWords.java`:

- En habla conectada y sin énfasis, la function word va en **forma débil**.
- Va en **forma fuerte** al final de la oración o antes de una pausa («Where are you *from*?»),
  salvo los pronombres personales, que siguen débiles; y cuando el alumno la marca como enfatizada.
- Ante vocal se usa la forma débil específica: *the* /ði/, *to* /tʊ/.
- La /h/ de *he, him, his, her, have, has, had* se pronuncia sólo al comienzo de la oración.
- Casos que dependen del sentido, resueltos por contexto y señalados al alumno con un aviso:
  *that* (demostrativo fuerte / conjunción débil), *there* (de lugar / existencial),
  *have, has, had, do, does* (verbo principal / auxiliar) y *some*. El alumno puede corregir la
  forma con un clic.

Las formas de cada palabra salen de Longman, que las publica etiquetadas (*the* /ðə; before vowels
ði; strong ðiː/). Mientras una palabra no se consultó se usa una tabla de referencia con las formas
de Roach en notación Longman, y la transcripción se actualiza sola cuando Longman responde. Las
palabras que no están en ningún diccionario (sobre todo formas flexionadas) se arman desde la base
(*watered* ← *water* + -ed) y se marcan como «armada».

### La voz británica

Es **Cori**, una voz del proyecto Piper (femenina, del sur de Inglaterra, alta calidad), entrenada
con grabaciones de LibriVox de dominio público. Corre dentro de la app con ONNX Runtime para Java
(Microsoft, MIT): no usa servicios externos ni necesita conexión. La primera lectura tarda un poco más de un
segundo porque carga el modelo; después cada oración se genera en menos de 0,1 s.

Piper recibe fonemas, no texto, así que la voz pronuncia **la transcripción que muestra la app**:
si el alumno enfatiza una function word, se oye la forma fuerte. Como la voz se entrenó con la
notación de eSpeak, la transcripción se convierte antes (TRAP /a/, DRESS /ɛ/, NEAR /iə/, /ɹ/, y el
acento justo antes de la vocal). Esa conversión se calibró contra eSpeak con las palabras de la tabla
fonémica y hay una prueba que lo verifica (`TtsTest`, contra lo que escribe eSpeak para esas palabras,
guardado en `sidecar-java/src/test/resources/espeak-calibracion.json`).

Es una voz sintética: suena natural pero no es una grabación. Las grabaciones reales de Longman
siguen disponibles palabra por palabra (cada una pronunciada aislada, en su forma de diccionario).

### El análisis gramatical

Lo hace **spaCy** (MIT) con su modelo `en_core_web_sm` (MIT), empaquetado con PyInstaller como un
programa aparte que la app lanza la primera vez que se analiza algo (tarda alrededor de un segundo
en cargar; después, cada oración es instantánea). spaCy devuelve el árbol de dependencias y
`QuirkAnalysis.java` (paquete `grammar` del motor) lo traduce a Quirk / Greenbaum:

| spaCy | Quirk |
| --- | --- |
| nsubj, nsubjpass, expl | S (con *there* existencial y sujeto nocional) |
| verbo + aux, auxpass, neg, prt | V (frase verbal; partida en las preguntas: *Have … been*) |
| dobj · dative · attr / acomp · oprd | Od · Oi · Cs · Co |
| prep, advmod, npadvmod, advcl, agent | A (obligatorio en SVA / SVOA según el verbo) |
| ccomp, xcomp, csubj · advcl · relcl · acl | cláusula nominal · adverbial · relativa · no finita |

El modelo chico de spaCy se equivoca en algunos patrones de manual y hay reglas que los corrigen
(con pruebas): *The soup tasted delicious* (toma el adjetivo como objeto), *They painted the walls
white* (lo toma como adverbial) y *They elected her president* (une *her president*). La paráfrasis
preposicional del objeto indirecto (*gave the book to my brother*) se muestra como A con una nota,
porque los criterios varían. También se corrigen la inversión (el sujeto que spaCy toma como
objeto en *In the corner stood…*), los adverbiales obligatorios adelantados (*Where did you put…?*),
*never* (adverbial, no parte del verbo), las imperativas con *don't* y las «minicláusulas» de los
transitivos complejos (*made everyone happy*, *named their daughter Lucy*). La pantalla aclara que
el análisis es automático: es un punto de partida, no reemplaza el criterio de la cátedra. Los
ejercicios, en cambio, tienen las respuestas escritas a mano, y una prueba verifica que el
analizador coincide con las 38.

### Cómo se comparan las pronunciaciones

Distancia de edición entre secuencias de fonemas, donde cambiar un fonema por otro parecido
cuesta menos (/ɪ/ por /iː/ cuesta 0,4; /ɪ/ por /ɑː/, 0,85) y algunos agregados u omisiones
frecuentes también (/ə/, /r/, /j/). Los valores están en tablas al principio de
`Distance.java` (paquete `core` del motor) para poder ajustarlos con criterio docente. El acento sólo se tiene
en cuenta si el alumno lo activa; en ese caso, marcarlo en otra sílaba suma 0,5.

## Aviso sobre el uso de Longman

Las transcripciones, definiciones y audios son de Pearson (Longman). Los términos de uso del sitio
pueden no permitir el acceso automatizado aunque sea a pedido del usuario y con caché. Antes de
distribuir la aplicación a la institución conviene consultarlo con Pearson o pedir una licencia.
Todo el acceso a Longman está aislado en el paquete `ldoce` del motor Java, así que se puede reemplazar por otra
fuente sin tocar la interfaz.

## Pendiente

- Resaltar la palabra que está diciendo la voz británica (el modelo no informa los tiempos de cada
  palabra; hoy sólo se resalta en el modo palabra por palabra).
- Árboles de constituyentes (estilo Aarts) a partir del mismo análisis, si la cátedra los usa.
- Más ejercicios de gramática (tipos de cláusula subordinada, grupo verbal) y de fonética
  (acento de palabra, entonación).

- Ícono propio y firma de código del ejecutable (hoy usa el ícono de Electron y Windows puede
  mostrar el aviso de SmartScreen la primera vez).
- Ampliar el índice local (Britfone no trae todas las formas flexionadas).
- Versiones para macOS y Linux (`electron-builder --mac` / `--linux`, hay que generarlas en esos sistemas).
