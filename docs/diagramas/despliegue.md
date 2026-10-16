# Despliegue

Todo corre en la PC del alumno. Lo único externo es Longman (sólo para palabras que no se consultaron
antes) y GitHub Releases (para buscar actualizaciones).

```mermaid
flowchart LR
    subgraph pc[PC del alumno · Windows]
        subgraph inst[Carpeta de instalación]
            exe[FoneticaRP.exe<br/>Electron + Angular]
            subgraph res[resources/]
                side[sidecar/<br/>fonetica-sidecar.jar<br/>native/ ONNX Runtime<br/>runtime/ Java 25 jlink]
                nlp[nlp/<br/>nlp-server.exe<br/>spaCy + en_core_web_sm]
                piper[piper/<br/>voz Cori .onnx]
                brit[britfone/<br/>CSV MIT]
            end
        end
        data[(%APPDATA%\dmc00-language-assistant<br/>ldoce-cache.json · audio/*.mp3<br/>preferencias)]
    end
    exe -- stdin/stdout JSON por línea --> side
    side -- stdin/stdout JSON por línea --> nlp
    side --> piper
    side --> brit
    side --> data
    side -- HTTPS, 1 pedido/s, sólo lo no consultado --> ldoce[ldoceonline.com]
    exe -- electron-updater, al iniciar --> gh[GitHub Releases<br/>Dmcrow00/language-assistant]
    rel[GitHub Actions release.yml<br/>al pushear un tag vX.Y.Z] -. npm run dist + gh release create .-> gh
```

| Pieza | Origen | Cómo llega |
|---|---|---|
| `FoneticaRP-Setup-x.y.z.exe` | `npm run dist` (electron-builder, NSIS), en `release.yml` | GitHub Releases (o copia directa) |
| `resources/sidecar` | `npm run build:sidecar` (Maven + jlink) | dentro del instalador |
| `resources/nlp` | `npm run build:nlp` (PyInstaller) | dentro del instalador |
| `resources/piper` | `npm run fetch-voice` (Hugging Face, con MD5) | dentro del instalador |
| Caché y preferencias | la app, con el uso | `%APPDATA%`, nunca junto al ejecutable |
