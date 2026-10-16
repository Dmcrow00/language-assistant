# ADR-0003: La paridad con el motor TypeScript se verifica con datos dorados y el TypeScript se borra

- Estado: Aceptada
- Fecha: 2026-10-16
- Decide: Claude (Fase 5), a revisar por el dueño en el PR

## Contexto

La regla del workspace es retirar el código viejo recién con la paridad verificada. El motor TypeScript
tenía 102 casos de `node:test` (el inventario los contaba como 81, sin separar los parametrizados), pero
esos casos miran unos pocos campos de cada respuesta: un port que los pasa puede igual diferir en el
orden de los resultados, en un campo opcional o en un decimal, y la interfaz lo mostraría distinto.

## Opciones

1. Portar sólo los casos de `node:test` y mantener el TypeScript una versión más, por las dudas.
2. **Portar los casos y además comparar el motor Java contra respuestas completas del TypeScript**
   (datos dorados) sobre un corpus amplio, y borrar el TypeScript en el mismo PR.

## Decisión

Opción 2. Antes de borrar el TypeScript se corrió `electron/test/paridad/generar-paridad.ts` (queda en la
historia, commit `9a007b9`) sobre: el léxico completo de Britfone, búsquedas por ortografía y por fonemas,
oraciones con y sin habla conectada y con formas forzadas, notación eSpeak, terminaciones, dictado, el
orden de `localeCompare` y el análisis gramatical de las 58 oraciones del fixture de spaCy. `ParidadTest`
compara campo por campo (mismos campos presentes, mismos valores). Además se comprobó:

- con una caché real de Longman (48 consultas de versiones 2 y 3 del parser): mismo léxico y mismas
  respuestas en los dos motores;
- de punta a punta, por el protocolo real, que tres oraciones llegan a Electron igual que el dato dorado
  (`electron/test/sidecar-client.test.ts`);
- a mano, con la app y el instalador armados (capturas en `docs/capturas/`).

## Consecuencias

- El TypeScript de `electron/core`, `ldoce`, `tts` y `grammar` y sus tests se borraron en este PR.
- Diferencias aceptadas a propósito: la versión TypeScript fallaba con oraciones que tenían la palabra
  "constructor" (Java no); los mensajes de error de red de Longman son los del cliente HTTP de Java
  (antes, los de Chromium).
- Un cambio de comportamiento futuro tiene que tocar el JSON dorado en el mismo commit, con el porqué.
