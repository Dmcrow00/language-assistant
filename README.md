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
[Cómo está armada](#cómo-está-armada)

## Instalación

Para alumnos y docentes que sólo quieren usar la aplicación.

**Requisitos**: Windows 10 u 11 de 64 bits y unos 700 MB libres. Hace falta conexión a internet
sólo para consultar en Longman palabras que todavía no se buscaron; lo ya consultado, la voz
británica, el análisis gramatical y las prácticas funcionan sin conexión.

Hay dos versiones; las dos hacen lo mismo:

| Archivo | Cuándo usarlo |
| --- | --- |
| `FoneticaRP-Setup-x.y.z.exe` | Instalador. Queda en el menú Inicio y abre más rápido. Recomendado para la computadora personal. |
| `FoneticaRP-Portable-x.y.z.exe` | No se instala: se abre con doble clic desde cualquier carpeta o pendrive. Tarda unos segundos más en abrir porque se descomprime cada vez. Útil en computadoras de laboratorio. |

Los dos archivos se generan con `npm run dist` (ver [Compilación](#compilación)) y quedan en la
carpeta `release/`. Para repartirlos, se pueden publicar como *Release* en GitHub o compartir por
el campus o una carpeta en la nube.

### Con el instalador

1. Doble clic en `FoneticaRP-Setup-x.y.z.exe`.
2. Windows puede mostrar «Windows protegió su PC» porque el ejecutable no tiene firma digital:
   elegir **Más información → Ejecutar de todas formas**.
3. Elegir la carpeta de instalación (se instala para el usuario actual, sin permisos de
   administrador) y terminar. Quedan accesos directos en el escritorio y en el menú Inicio.

Para desinstalar: **Configuración de Windows → Aplicaciones → Fonética RP → Desinstalar**.

### Con la versión portable

Copiar `FoneticaRP-Portable-x.y.z.exe` donde se quiera y abrirlo con doble clic (la primera vez
puede aparecer el mismo aviso de Windows). Para quitarla alcanza con borrar el archivo.

### Datos que guarda

Las palabras ya consultadas en Longman y sus audios quedan en `%APPDATA%\dmc00-language-assistant`
(así funcionan sin conexión la próxima vez). Borrar esa carpeta deja la aplicación como recién
instalada.

## Uso

**Generalidades**

- Arriba se elige el menú (**Fonética** o **Gramática**) y debajo, la pantalla. Cada pantalla
  conserva lo escrito al cambiar de una a otra.
- **Audio lento** (arriba a la derecha) reproduce todos los audios más despacio, sin cambiar el
  tono.
- La primera vez que se usa la voz británica tarda alrededor de un segundo, y el primer análisis
  gramatical, uno o dos; después es instantáneo.
- Cada palabra nueva se consulta en Longman (como máximo una por segundo) y queda guardada.
- Etiquetas de las transcripciones: **Longman** = verificada en Longman; **aprox.** = del
  diccionario abierto Britfone, todavía no verificada; **armada** = formada a partir de otra
  palabra (*watered* ← *water* + -ed).

### Fonética → Buscar palabra

Transcripción, audio y formas de una palabra.

1. Escribir la palabra con su ortografía normal, aunque sea con errores («watre», «recieve»,
   «fonetik»): la lista muestra palabras parecidas con su transcripción.
2. Elegir con clic, o moverse con **↑ ↓** y confirmar con **Enter**. Enter sin elegir nada busca en
   Longman lo escrito tal cual; si no existe, Longman sugiere alternativas («¿Quisiste decir…?»).
3. La ficha muestra la transcripción británica (RP) y la americana, las formas débil y fuerte si
   las tiene, una definición corta para distinguir homófonos, **▶ Escuchar** (británico) y **▶**
   (americano), y **Ver en Longman ↗**.

**Esc** borra la búsqueda.

### Fonética → Teclado fonético

Escribir cómo suena una palabra y encontrar cuál es.

1. Tocar los fonemas en el teclado (ordenado como la tabla fonémica de Underhill). Los diptongos
   y las africadas son una sola tecla; **ˈ** y **ˌ** marcan el acento.
2. Los resultados se actualizan solos: **Suena exactamente así** (homófonos) y **Lo más parecido**,
   comparado fonema por fonema: verde = coincide, naranja = cambiado (en chiquito, lo que se
   escribió), rojo subrayado = faltó, tachado = sobra.
3. Clic en una palabra: su ficha de Longman con audio.
4. **▶ Escuchar lo que escribí**: la voz británica pronuncia exactamente lo escrito, para comparar
   con la palabra real.
5. **Clic derecho** sobre una tecla: se escucha la palabra de ejemplo de ese fonema.
6. **Tener en cuenta el acento**: si se marca el acento en otra sílaba, la palabra queda más lejos.

Con el teclado de la computadora: **Retroceso** borra el último fonema y **Esc** limpia todo.

### Fonética → Oración

Transcripción de una oración completa, con formas débiles y fuertes.

1. Escribir la oración y apretar **Enter** (**Shift + Enter** para cambiar de renglón). La
   transcripción aparece enseguida y se va corrigiendo a medida que responde Longman («Consultando
   Longman: 3 de 9 palabras…»).
2. Cada palabra muestra su transcripción: violeta = *function word* en forma **débil**, naranja =
   forma **fuerte**, *r* azul = r de enlace, borde punteado = transcripción aproximada.
3. **Clic** en una palabra: su ficha y, si es una *function word*, por qué lleva esa forma y un
   botón para enfatizarla (forma fuerte) o quitarle el énfasis; la transcripción y la voz cambian.
   **Doble clic**: escucharla.
4. **Habla conectada** (activada): formas débiles y r de enlace; desactivada, cada palabra en su
   forma de cita. **Procesos del habla conectada**: marca además asimilación (*ten boys* /tem/),
   elisión (*next day* /neks/), coalescencia (*don't you* /dəʊntʃu/) y r intrusiva (*idea of*),
   con la lista de los procesos debajo.
5. **▶ Voz británica**: lee la oración tal como está transcripta. **▶ Palabra por palabra
   (Longman)**: encadena las grabaciones reales de cada palabra (pronunciadas aisladas).
6. **Copiar**: copia la transcripción completa (con | para pausas menores y || para fin de
   oración).

### Fonética → Dictado

1. Elegir el nivel (vocales y diptongos, consonantes, ortografía engañosa, polisílabos y acento,
   frases con formas débiles) y apretar **Empezar**.
2. Escuchar (**▶ Escuchar de nuevo** las veces que haga falta) y transcribir con el teclado en
   pantalla; **Retroceso** borra el último fonema.
3. **Enter** (o **Corregir**): se muestra la transcripción correcta y la comparación fonema por
   fonema. **Enter** de nuevo pasa a la siguiente; **Saltear** cambia de palabra.

No se tiene en cuenta el acento. Las palabras usan la grabación y la transcripción de Longman.

### Fonética → Pares mínimos

1. Elegir un contraste a la izquierda (/iː/–/ɪ/, /b/–/v/, /s/–/θ/…); arriba se explica por qué
   cuesta.
2. **▶ Escuchar** y elegir cuál de las dos palabras sonó.
3. Después de responder se ven las dos transcripciones y se puede escuchar cada una.

**Sólo voz sintética** usa la voz británica en lugar de las grabaciones de Longman (sirve sin
conexión).

### Gramática → Análisis de oraciones

Análisis según Quirk / Greenbaum.

1. Escribir una o más oraciones (o hacer clic en un ejemplo) y apretar **Enter** o **Analizar**.
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

Es un análisis automático: puede equivocarse en oraciones ambiguas o poco frecuentes, así que
conviene usarlo como punto de partida y verificarlo con el criterio de la cátedra.

### Gramática → Grupo verbal

Escribir una o más oraciones (o hacer clic en un ejemplo): cada grupo verbal aparece desarmado en
sus partes (modal, auxiliar de perfecto, de progresivo, de pasiva, verbo léxico) con su nombre en
inglés (*present perfect progressive passive*) y la explicación. A la derecha están las
combinaciones de auxiliares y las formas no finitas.

### Gramática → Verbos irregulares

- **Tabla**: buscar por verbo o significado, filtrar por patrón (cut-cut-cut, keep-kept-kept,
  come-came-come, go-went-gone) y hacer clic en una forma para escucharla.
- **Práctica**: **Empezar** muestra un verbo (de la lista filtrada); escribir el pasado y el
  participio, **Enter** corrige y **Enter** de nuevo pasa al siguiente. Se aceptan las variantes
  (*learnt* o *learned*).
- **Pronunciación de -s y -ed**: escribir un verbo regular (o elegir un ejemplo) para ver cómo
  suenan sus terminaciones (/s/ /z/ /ɪz/, /t/ /d/ /ɪd/) y la regla que lo explica.

### Gramática → Ejercicios

1. Marcar la función de cada parte con los botones **S V Od Oi Cs Co A**. Lo que aparece en gris es
   contexto y no se analiza; si el verbo aparece en dos pedazos (*Did … send*), los dos son **V**.
2. Elegir **cómo es el sujeto**: expreso, implícito (imperativas) o elíptico (coordinadas).
3. Elegir el **tipo de cláusula** y apretar **Corregir**: cada parte se pinta de verde o rojo, se
   muestra la respuesta correcta y la explicación. **Siguiente** pasa a otro ejercicio.

Los 38 ejercicios salen en orden aleatorio y arriba se lleva la cuenta de aciertos.

### Si algo no funciona

| Qué pasa | Qué hacer |
| --- | --- |
| La aplicación no abre | Puede estar abierta (sólo se permite una ventana): buscarla en la barra de tareas. |
| «No se pudo conectar con Longman» | No hay internet. Lo ya consultado sigue disponible; para lo demás se muestra la transcripción aproximada y se puede escuchar con la voz británica. |
| No se oye nada | Revisar el volumen de Windows. La primera lectura de la voz británica tarda un segundo. |
| «El analizador gramatical no está instalado» o no aparece la voz británica | Sólo pasa en una copia de desarrollo armada sin `npm run build:nlp` o sin `npm run fetch-voice`. |

## Compilación

Para quien vaya a modificar la aplicación o generar el instalador.

**Requisitos**

- Windows 10 u 11 de 64 bits, con unos 3 GB libres (dependencias, entorno de Python y ejecutables).
- [Git](https://git-scm.com/) y [Node.js](https://nodejs.org/) 22.12 o superior (incluye npm).
- [Python](https://www.python.org/) 3.12 en el PATH, sólo para armar el analizador gramatical.
- Conexión a internet la primera vez: paquetes de npm, la voz británica (114 MB, de Hugging Face)
  y los paquetes de Python (spaCy, su modelo y PyInstaller, unos 60 MB).

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
- `npm start` compila la interfaz y el motor y abre la aplicación.

Sin la voz o sin el analizador la aplicación funciona igual, pero sin voz británica o sin análisis
gramatical.

**Durante el desarrollo**

- `npm run dev` abre la aplicación con recarga automática de la interfaz (los cambios en
  `electron/` requieren cerrarla y volver a abrirla).
- `npm run test:core` (motor) y `npm test` (interfaz) corren las pruebas.
- Los cambios nuevos se hacen en `develop` (o en ramas que salen de `develop`) y pasan a `main`
  cuando forman una versión estable.

**Generar el instalador**

1. Si es una versión nueva, actualizar `"version"` en `package.json` (el número va en el nombre de
   los archivos).
2. Cerrar la aplicación si está abierta (Windows no deja reemplazar el ejecutable en uso).
3. Correr `npm run dist`: compila todo, baja la voz y arma el analizador si faltan, y deja en
   `release/` el instalador y la versión portable.

### Comandos

| Comando | Para qué |
| --- | --- |
| `npm install` | Instala dependencias (incluye el binario de Electron). |
| `npm run fetch-voice` | Baja la voz británica (114 MB) a `resources/piper/` y verifica su MD5. `npm run dist` la baja sola si falta. |
| `npm run build:nlp` | Arma el analizador gramatical (spaCy) como ejecutable en `resources/nlp/`. Con `-- --force` lo rearma siempre. `npm run dist` lo arma solo si falta. |
| `npm start` | Compila todo y abre la aplicación. |
| `npm run dev` | Desarrollo: `ng serve` con recarga automática + Electron apuntando a él. |
| `npm run test:core` | Pruebas del motor (búsquedas, transcripciones, Longman, oraciones, voz, gramática) con `node --test`. |
| `npm test` | Pruebas de la interfaz (Vitest). |
| `npm run dist` | Genera en `release/` el instalador (`FoneticaRP-Setup-x.y.z.exe`) y la versión portable (`FoneticaRP-Portable-x.y.z.exe`), con la voz y el analizador incluidos. |

### Problemas al compilar

| Qué pasa | Qué hacer |
| --- | --- |
| Electron no arranca después de `npm install` porque falta su binario | `node node_modules/electron/install.js` |
| `npm run build:nlp` dice que no encuentra `python` | Instalar Python 3.12 y marcar «Add python.exe to PATH»; abrir una terminal nueva. |
| `npm run dist` falla porque un archivo está en uso | Cerrar la aplicación (instalada o portable) y repetir. |
| `npm start` o `npm run dev` no abren ninguna ventana | Ya hay otra instancia abierta (también la instalada): cerrarla. |

## Cómo está armada

```
electron/                 Proceso principal (Node): motor y acceso a Longman
  main.ts                 Ventana, protocolo app:// para servir la interfaz, arranque
  preload.ts              Puente seguro: expone window.fonetica a la interfaz
  ipc.ts                  Handlers IPC; valida todo lo que llega de la interfaz
  core/ipa.ts             Normalización de notación y separación en fonemas
  core/transcription.ts   Alternativas abreviadas de Longman, sonidos opcionales, Britfone → Longman
  core/distance.ts        Distancias ortográfica y fonémica (tabla de costos ajustable)
  core/lexicon.ts         Índice local de palabras y las dos búsquedas
  ldoce/ldoce-parser.ts   Lectura del HTML de Longman (único archivo a tocar si cambia el sitio)
  ldoce/ldoce-client.ts   Consultas a Longman con caché y una consulta por segundo como máximo
  ldoce/ldoce-cache.ts    Caché en disco de consultas y audios
  core/function-words.ts  Formas fuertes y débiles: tabla de referencia y reglas de contexto
  core/sentence.ts        Transcripción de oraciones (pausas, r de enlace, palabras derivadas)
  tts/piper-voice.ts      Voz británica: ejecuta el modelo de Piper con ONNX Runtime
  core/connected-speech.ts  Procesos del habla conectada (asimilación, elisión, coalescencia, r)
  core/study-tools.ts     Corrección del dictado y terminaciones -s / -ed
  tts/espeak-notation.ts  Notación Longman → notación con la que se entrenó la voz
  grammar/nlp-client.ts   Lanza y habla con el analizador spaCy (proceso aparte)
  grammar/quirk-analysis.ts  Árbol de dependencias de spaCy → análisis de Quirk / Greenbaum
  test/                   Pruebas del motor
shared/                   Código común a los dos procesos
  fonetica-api.ts         Contrato entre interfaz y motor (tipos y canales IPC)
  phoneme-inventory.ts    Inventario de fonemas RP con palabras de ejemplo
  grammar.ts              Tipos del análisis gramatical (SVOCA, frases, cláusulas, grupo verbal)
  study-data/             Material de estudio: verbos irregulares, ejercicios, dictado, pares mínimos
src/app/                  Interfaz (Angular 21, componentes standalone y signals)
  app.ts                  Menú general (Fonética / Gramática) y submenús
  features/phonetics/     Buscar palabra, teclado, oración, dictado, pares mínimos
  features/grammar/       Análisis de oraciones, grupo verbal, verbos irregulares, ejercicios
  shared/word-detail/     Ficha de la palabra con audio (la usan varias pantallas)
nlp/nlp_server.py         Analizador spaCy (Python): devuelve el árbol de dependencias
nlp/requirements.lock.txt Versiones fijadas de spaCy, el modelo y PyInstaller
resources/britfone/       Diccionario abierto Britfone (MIT) que se empaqueta con la app
resources/piper/          Voz británica (se baja con npm run fetch-voice; no va al repositorio)
resources/nlp/            Analizador empaquetado (se arma con npm run build:nlp; no va al repositorio)
scripts/fetch-voice.mjs   Descarga y verificación de la voz
scripts/build-nlp.mjs     Empaquetado del analizador con PyInstaller
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
`electron/core/function-words.ts`:

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
con grabaciones de LibriVox de dominio público. Corre dentro de la app con ONNX Runtime (Microsoft,
MIT): no usa servicios externos ni necesita conexión. La primera lectura tarda un poco más de un
segundo porque carga el modelo; después cada oración se genera en menos de 0,1 s.

Piper recibe fonemas, no texto, así que la voz pronuncia **la transcripción que muestra la app**:
si el alumno enfatiza una function word, se oye la forma fuerte. Como la voz se entrenó con la
notación de eSpeak, la transcripción se convierte antes (TRAP /a/, DRESS /ɛ/, NEAR /iə/, /ɹ/, y el
acento justo antes de la vocal). Esa conversión se calibró contra eSpeak con las palabras de la tabla
fonémica y hay una prueba que lo verifica (`electron/test/tts.test.ts`, usa el paquete `phonemizer`
sólo en desarrollo).

Es una voz sintética: suena natural pero no es una grabación. Las grabaciones reales de Longman
siguen disponibles palabra por palabra (cada una pronunciada aislada, en su forma de diccionario).

### El análisis gramatical

Lo hace **spaCy** (MIT) con su modelo `en_core_web_sm` (MIT), empaquetado con PyInstaller como un
programa aparte que la app lanza la primera vez que se analiza algo (tarda alrededor de un segundo
en cargar; después, cada oración es instantánea). spaCy devuelve el árbol de dependencias y
`electron/grammar/quirk-analysis.ts` lo traduce a Quirk / Greenbaum:

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
`electron/core/distance.ts` para poder ajustarlos con criterio docente. El acento sólo se tiene
en cuenta si el alumno lo activa; en ese caso, marcarlo en otra sílaba suma 0,5.

## Aviso sobre el uso de Longman

Las transcripciones, definiciones y audios son de Pearson (Longman). Los términos de uso del sitio
pueden no permitir el acceso automatizado aunque sea a pedido del usuario y con caché. Antes de
distribuir la aplicación a la institución conviene consultarlo con Pearson o pedir una licencia.
Todo el acceso a Longman está aislado en `electron/ldoce/`, así que se puede reemplazar por otra
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
