# Secuencias

## Una consulta IPC: buscar una palabra en Longman

El alumno elige "thought" en Buscar palabra. Es el camino de cualquier canal del motor; los otros sólo
cambian lo que pasa dentro de `Handlers`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Alumno
    participant R as Interfaz (Angular)
    participant P as preload.ts
    participant I as ipc.ts (Electron main)
    participant C as SidecarClient
    participant S as JsonLineServer (Java)
    participant H as Handlers
    participant L as LdoceClient
    participant W as ldoceonline.com
    U->>R: elige «thought»
    R->>P: window.fonetica.lookupLdoce("thought")
    P->>I: invoke("ldoce:lookup", "thought")
    I->>I: remitente app://bundle · texto ≤ 60
    I->>C: call("ldoce:lookup", "thought")
    C->>S: {"id":12,"channel":"ldoce:lookup","args":["thought"]}
    S->>H: handle (hilo virtual)
    H->>H: misma validación (Input.text)
    H->>L: lookup("thought")
    alt está en la caché (misma versión del parser, menos de 180 días)
        L-->>H: consulta guardada (fromCache = true)
    else no está
        L->>L: espera hasta 1 s desde el último pedido
        L->>W: GET /search/english/direct/?q=thought
        W-->>L: HTML de la entrada (o de sugerencias)
        L->>L: LdoceParser (jsoup) · LdoceCache.set (se escribe a los 500 ms)
        L-->>H: entradas (fromCache = false)
    end
    H->>H: el léxico pasa a usar la transcripción de Longman
    H-->>S: Result.Json(LdoceLookup)
    S-->>C: {"id":12,"result":{"query":"thought","status":"found",...}}
    C-->>I: objeto JSON
    I-->>P: el mismo objeto
    P-->>R: la promesa se resuelve con la consulta
    R-->>U: ficha con /θɔːt/, audio y definición
```

Si el motor responde `{"id":12,"error":"..."}`, `SidecarClient` rechaza la promesa con ese mensaje y la
interfaz lo recibe igual que antes (`Error invoking remote method 'ldoce:lookup': Error: ...`). Si no
responde en 60 s, o el proceso se cae, la promesa se rechaza y el próximo pedido relanza el motor.

## Análisis gramatical (motor → spaCy)

```mermaid
sequenceDiagram
    autonumber
    participant I as ipc.ts
    participant H as Handlers (Java)
    participant N as NlpClient
    participant Y as nlp-server (spaCy)
    I->>H: grammar:analyze "She reads novels."
    H->>N: parse(text)
    opt primera vez (o se había caído)
        N->>Y: lanza nlp-server.exe (o nlp/.venv en desarrollo)
        Y-->>N: {"ready": true}
    end
    N->>Y: {"id":1,"text":"She reads novels."}
    Y-->>N: {"id":1,"tokens":[{"dep":"nsubj",...},...]}
    N-->>H: los tokens (espera hasta 30 s)
    H->>H: QuirkAnalysis.analyzeGrammar → S V Od, patrón SVO
    H-->>I: GrammarAnalysis
```

## Arranque y cierre

```mermaid
sequenceDiagram
    autonumber
    participant E as Electron main
    participant J as Motor Java
    participant Y as spaCy
    E->>J: lanza java -jar fonetica-sidecar.jar --resources … --user-data …
    J->>J: carga Britfone (15 212 palabras) y la caché de Longman
    J-->>E: {"ready":true,"words":15212,"voice":true,"grammar":true}
    E->>E: abre la ventana (los pedidos que lleguen antes esperan el "ready")
    Note over E,J: … uso normal …
    E->>J: cierra stdin (before-quit)
    J->>J: termina los pedidos en curso, guarda la caché
    J->>Y: destroy()
    J-->>E: exit 0
```

## Actualización automática

```mermaid
sequenceDiagram
    autonumber
    participant A as App instalada (al iniciar)
    participant G as GitHub Releases (Dmcrow00/language-assistant)
    actor U as Alumno
    A->>G: latest.yml de la última release
    alt hay una versión mayor
        A->>G: baja FoneticaRP-Setup-X.Y.Z.exe (diferencial con el .blockmap)
        A->>A: verifica el SHA-512 de latest.yml
        A->>U: notificación «Hay una versión nueva, se instala al cerrar»
        U->>A: cierra la app
        A->>A: instala la versión nueva
    else sin novedades, sin conexión o sin releases
        A->>A: sigue normalmente (aviso en la consola)
    end
```
