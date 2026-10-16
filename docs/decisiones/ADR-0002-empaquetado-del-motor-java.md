# ADR-0002: El motor va al instalador como jar único + nativas de ONNX + Java mínimo de jlink

- Estado: Aceptada
- Fecha: 2026-10-16
- Decide: Claude (Fase 5), a revisar por el dueño en el PR

## Contexto

El instalador lo arma electron-builder (NSIS + portable) y antes pesaba 279 MB. El motor Java necesita un
Java 25 que el alumno no tiene instalado, sus dependencias (Jackson, jsoup, ONNX Runtime) y las
librerías nativas de ONNX Runtime. El jar de ONNX Runtime de Maven trae las nativas de todas las
plataformas (55 MB) y, si no se le indica otra cosa, las extrae a la carpeta temporal en cada arranque.

## Opciones

1. **jlink + jar único (maven-shade) + `native/` aparte**, todo como `extraResources` de electron-builder.
   Ventajas: un solo instalador, como antes; Java mínimo (36 MB con 4 módulos); sólo las nativas de
   Windows x64 (16 MB); nada se extrae al temporal. Desventajas: la lista de módulos de jlink se mantiene
   a mano (hay una prueba del runtime armado en `build-sidecar.mjs`).
2. **jpackage** para el motor (un .exe propio). Duplica lo que ya hace electron-builder y agrega un
   segundo instalador o un app-image dentro de otro.
3. **Pedir que el alumno instale Java.** Rompe "doble clic y funciona" y la versión portable.
4. **GraalVM native-image.** Arranque instantáneo, pero JNI de ONNX Runtime y reflexión de Jackson
   piden configuración extra y otra cadena de herramientas; no hace falta para un proceso que arranca
   una vez.

## Decisión

Opción 1. `./mvnw package -Pempaquetado` (lo llama `npm run build:sidecar`) deja en
`sidecar-java/target/sidecar/` el jar, `native/` y `runtime/` (jlink: `java.base`, `java.logging`,
`java.net.http`, `java.xml`, con `--strip-debug --no-header-files --no-man-pages --compress=zip-9`), y
electron-builder lo copia a `resources/sidecar/`. Electron lanza `runtime/bin/java.exe -jar
fonetica-sidecar.jar`; el motor apunta `onnxruntime.native.path` a `native/`.

## Consecuencias

- El instalador pasa de 279,46 MB a 300,56 MB (+21,1 MB, +7,5 %): suma el runtime y las nativas de ONNX
  para Java, y resta `onnxruntime-node`.
- Agregar una librería al motor puede requerir otro módulo en jlink: `jdeps --print-module-deps` sobre el
  jar orienta, pero la prueba que manda es la de `build-sidecar.mjs` (Jackson 3 necesita `java.xml`
  aunque jdeps lo marque como opcional).
- El build del instalador necesita JDK 25 en la PC del dueño (además de Node y Python).
