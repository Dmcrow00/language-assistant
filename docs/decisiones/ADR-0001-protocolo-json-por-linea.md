# ADR-0001: Electron habla con el motor Java por stdin/stdout, una línea JSON por pedido

- Estado: Aceptada
- Fecha: 2026-10-16
- Decide: Claude (Fase 5), a revisar por el dueño en el PR

## Contexto

El ADR-0002 de `dmc00-workspace` movió la lógica del proceso main de Electron a un proceso Java aparte y
dejó para esta fase elegir el protocolo: JSON por línea por stdin/stdout (como el analizador spaCy) o
HTTP local. Restricciones: el contrato con la interfaz no cambia (`shared/fonetica-api.ts`), hay
respuestas binarias (WAV de la voz, MP3 de Longman), la app es de escritorio y se instala sin permisos de
administrador, y no puede exponer nada a la red.

## Opciones

1. **JSON por línea por stdin/stdout**, con id por pedido y timeout. Ventajas: es el protocolo que ya usa
   spaCy (mismo cliente, misma forma de razonar); no abre puertos, así que ningún otro programa de la PC
   puede llamar al motor y no hay avisos del firewall de Windows; el motor muere solo cuando se cierra su
   entrada (Electron se cierra o se cae). Desventajas: el binario viaja en base64 (+33 %; un WAV de una
   oración larga son ~2 MB, irrelevante en memoria local); hay que escribir el emparejamiento de
   respuestas por id (unas 100 líneas en `sidecar-client.ts`).
2. **HTTP local** (por ejemplo `HttpServer` del JDK en `127.0.0.1` con un puerto al azar). Ventajas:
   binario sin base64, herramientas conocidas (curl). Desventajas: un puerto abierto que cualquier
   proceso del usuario puede usar (habría que agregar un token por arranque), el firewall puede preguntar,
   hay que descubrir el puerto y vigilar que el proceso muera con Electron.

## Decisión

Opción 1. Mensajes:

```
al iniciar:  {"ready": true, "version": "0.0.1", "words": 15212, "voice": true, "grammar": true}
pedido:      {"id": 7, "channel": "<canal de shared/fonetica-api.ts>", "args": [...]}
respuesta:   {"id": 7, "result": <JSON>} | {"id": 7, "bytes": "<base64>"} | {"id": 7, "error": "<mensaje>"}
```

El canal y los argumentos son los mismos del IPC de Electron, así que `ipc.ts` sólo valida y reenvía.
Timeout de 60 s en Electron (más que los 30 s que el motor le da a spaCy, porque un análisis puede incluir
su arranque). stdout es exclusivo del protocolo; los avisos del motor van a stderr.

## Consecuencias

- Electron tiene un único cliente genérico (`SidecarClient`) para los 14 canales del motor.
- Un error de validación o de ejecución en Java llega a la interfaz con el mismo texto que antes.
- El motor atiende pedidos en paralelo (hilos virtuales): el `Lexicon` y la caché son `synchronized`.
- Si en el futuro otra app necesita el motor (por ejemplo, una versión web), habría que agregar una
  entrada HTTP: `Handlers` no depende del transporte.
