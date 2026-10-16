# Decisiones de arquitectura (ADR)

Un archivo por decisión: `ADR-NNNN-titulo-corto.md` (formato en
`dmc00-workspace/docs/convenciones/documentacion.md` §4). Nunca se borra una; si se revierte, se crea otra
que la reemplaza. La decisión de mover el motor a Java es el ADR-0002 de `dmc00-workspace`.

| ADR | Título | Estado | Fecha |
|---|---|---|---|
| [0001](ADR-0001-protocolo-json-por-linea.md) | Electron habla con el motor Java por stdin/stdout, una línea JSON por pedido | Aceptada | 2026-10-16 |
| [0002](ADR-0002-empaquetado-del-motor-java.md) | El motor va al instalador como jar único + nativas de ONNX + Java mínimo de jlink | Aceptada | 2026-10-16 |
| [0003](ADR-0003-paridad-con-datos-dorados.md) | La paridad con el motor TypeScript se verifica con datos dorados y el TypeScript se borra | Aceptada | 2026-10-16 |
