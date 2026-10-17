# Documentación de Fonética RP

| Documento | Para quién | Qué contiene |
|---|---|---|
| [../README.md](../README.md) | alumnos, docentes, quien programa | instalación, uso pantalla por pantalla, compilación, reglas de fonética y gramática que aplica la app |
| [documentacion-tecnica.md](documentacion-tecnica.md) | quien programa | arquitectura (Electron + motor Java + spaCy), protocolo con el motor, módulos, cómo agregar un canal, tests, trampas |
| [guia-entorno-local-y-despliegue.md](guia-entorno-local-y-despliegue.md) | quien instala o publica | entorno local, versiones, armado del instalador, actualización automática, publicar una versión, rollback |
| [diagramas/](diagramas/) | todos | [clases del motor](diagramas/clases.md), [secuencias](diagramas/secuencias.md) (una consulta IPC, el análisis gramatical, la actualización) y [despliegue](diagramas/despliegue.md) |
| [decisiones/](decisiones/README.md) | todos | decisiones de arquitectura (ADR) de este repo; la de mover el motor a Java es el ADR-0002 de `dmc00-workspace` |
| [capturas/](capturas/) | todos | una captura por pantalla, con el motor Java (`node scripts/capturas.mjs`) |

La documentación funcional (qué reglas de fonética y gramática aplica la app y por qué) está en el
README, secciones «Uso» y «Cómo está armada». No hay base de datos ni máquinas de estado: por eso no hay
`der.md` ni `estados.md`.
