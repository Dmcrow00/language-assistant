# Fonética RP

Repositorio: https://github.com/Dmcrow00/language-assistant (carpeta local `dmc00-language-assistant`).
Ramas: `main` (versiones estables) y `develop` (desarrollo de nuevas funciones).

Aplicación de escritorio para estudiar la fonética (inglés británico, Received Pronunciation) y la
gramática del inglés en el profesorado. Tiene dos menús.

### Fonética

1. **Buscar palabra**: el alumno escribe la palabra con su ortografía normal. Mientras escribe ve
   palabras parecidas con su transcripción (sirve aunque la escriba mal: «watre», «recieve»,
   «fonetik»). Al elegir una se consulta Longman y se muestra la palabra, la transcripción RP (con
   sus formas débil y fuerte si las tiene), la variante americana, una definición corta y los
   botones para escuchar el audio británico y el americano. Si la palabra no existe, Longman
   sugiere alternativas («¿Quisiste decir…?»).
2. **Teclado fonético**: un teclado en pantalla con los 44 fonemas del RP, ordenado como la tabla
   fonémica de Underhill (British Council), más las vocales débiles /i/ y /u/ y las marcas de
   acento. El alumno escribe cómo cree que suena una palabra y la app la compara con todo el
   diccionario: primero las que suenan exactamente así (homófonos) y después las más cercanas,
   marcando fonema por fonema qué coincide, qué cambió, qué faltó y qué sobra. «Escuchar lo que
   escribí» pronuncia con la voz británica exactamente esa transcripción. Clic derecho sobre una
   tecla reproduce la palabra de ejemplo de ese fonema.
3. **Oración**: la oración transcripta palabra por palabra y completa (lista para copiar, con |
   para pausas menores y || para fin de oración). Las *function words* aparecen en **forma débil o
   fuerte** según el contexto y la r de enlace se marca entre vocales. «Procesos del habla
   conectada» marca además asimilación (*ten boys* /tem/), elisión (*next day* /neks/), coalescencia
   (*don't you* /dəʊntʃu/) y r intrusiva (*idea of*). Clic en una palabra: ficha de Longman y, si es
   una function word, por qué lleva esa forma y un botón para enfatizarla o quitarle el énfasis. Se
   escucha con la **voz británica** (lee la transcripción tal como está) o palabra por palabra con
   las grabaciones de Longman.
4. **Dictado**: se escucha una palabra o frase y el alumno la transcribe con el teclado; se corrige
   fonema por fonema. Niveles: vocales y diptongos, consonantes, ortografía engañosa, polisílabos y
   frases con formas débiles. Las palabras usan la grabación y la transcripción de Longman.
5. **Pares mínimos**: suena una de dos palabras (*ship / sheep*, *berry / very*…) y el alumno elige
   cuál fue. 16 contrastes pensados para hispanohablantes, con una explicación de cada uno.

### Gramática (Quirk / Greenbaum)

1. **Análisis de oraciones**: tipo de oración (simple, compuesta, compleja, compuesta-compleja) y
   forma (declarativa, interrogativa, imperativa, exclamativa); cada cláusula con sus elementos
   **S V O C A** y su tipo (los siete patrones: SV, SVO, SVC, SVA, SVOO, SVOC, SVOA); la forma de
   cada elemento (NP, VP, AdjP, AdvP, PP o cláusula) y su estructura interna (determinante,
   premodificador, núcleo, posmodificador); las cláusulas subordinadas (nominales, adverbiales,
   relativas, finitas y no finitas), analizadas a su vez; las clases de palabras y los grupos
   verbales.
2. **Grupo verbal**: cada verbo desarmado en modal, auxiliar de perfecto, de progresivo, de pasiva y
   verbo léxico, con su nombre (*present perfect progressive passive*) y si es finito o no finito.
3. **Verbos irregulares**: unos 140 verbos con sus tres formas, transcripción y audio (incluidos los
   engañosos: *read* /riːd/ /red/ /red/), filtros por patrón (cut-cut-cut, keep-kept-kept,
   come-came-come, go-went-gone), práctica, y la pronunciación de **-s** (/s/ /z/ /ɪz/) y **-ed**
   (/t/ /d/ /ɪd/) de cualquier verbo regular con la regla que la explica.
4. **Ejercicios**: el alumno asigna la función de cada constituyente, dice cómo es el sujeto
   (expreso, implícito o elíptico) y elige el tipo de cláusula; 38 oraciones con respuestas
   escritas a mano y la explicación de cada una. Además del orden canónico hay preguntas (con el
   verbo partido: *Did … send*), adverbiales adelantados e inversión (*In the corner stood an old
   piano*), sujeto vacío (*It is raining*), imperativas (sujeto implícito *you*) y coordinadas con
   sujeto elíptico. Recuerdan que en inglés no hay sujeto tácito como en castellano: una cláusula
   finita lleva sujeto expreso, salvo esos casos.

El audio se puede reproducir más lento, sin cambiar el tono, con «Audio lento».

## Comandos

Requiere Node 22.12 o superior y, para armar el analizador gramatical, Python 3.12.

| Comando | Para qué |
| --- | --- |
| `npm install` | Instala dependencias (incluye el binario de Electron). |
| `npm run fetch-voice` | Baja la voz británica (114 MB) a `resources/piper/` y verifica su MD5. Sin ella la app funciona, pero sin voz sintética. `npm run dist` la baja sola si falta. |
| `npm run build:nlp` | Arma el analizador gramatical (spaCy) como ejecutable en `resources/nlp/`. La primera vez crea `nlp/.venv` e instala las versiones fijadas en `nlp/requirements.lock.txt`. `npm run dist` lo arma solo si falta. |
| `npm start` | Compila todo y abre la aplicación. |
| `npm run dev` | Desarrollo: `ng serve` con recarga automática + Electron apuntando a él. Los cambios en `electron/` requieren reiniciar. |
| `npm run test:core` | Pruebas del motor (búsquedas, transcripciones, lectura de Longman) con `node --test`. |
| `npm test` | Pruebas de la interfaz (Vitest). |
| `npm run dist` | Genera en `release/` el instalador (`FoneticaRP-Setup-x.y.z.exe`) y la versión portable (`FoneticaRP-Portable-x.y.z.exe`), con la voz y el analizador incluidos. |

Si después de `npm install` Electron no arranca porque falta su binario, correr
`node node_modules/electron/install.js`.

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
