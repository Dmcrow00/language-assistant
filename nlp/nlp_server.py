"""
Analizador sintáctico de la app: un proceso aparte que lanza Electron (electron/grammar/nlp-client.ts).

Usa spaCy con el modelo en_core_web_sm y devuelve el análisis "crudo" (clase de palabra, lema,
morfología y árbol de dependencias). La interpretación según Quirk/Greenbaum (SVOCA, frases,
tipos de cláusula) se hace en TypeScript, en electron/grammar/.

Protocolo: una línea JSON por pedido en la entrada estándar y una línea JSON por respuesta.
  pedido:    {"id": 1, "text": "The cat sat on the mat."}
  respuesta: {"id": 1, "tokens": [...]}    o    {"id": 1, "error": "..."}
Al arrancar escribe {"ready": true, ...} cuando el modelo ya está cargado.
"""

import json
import sys

import spacy


def load_model():
    import en_core_web_sm

    # El reconocimiento de entidades no se usa: se excluye para cargar más rápido.
    return en_core_web_sm.load(exclude=["ner"])


def token_json(token):
    return {
        "i": token.i,
        "text": token.text,
        "ws": token.whitespace_,
        "idx": token.idx,
        "lemma": token.lemma_,
        "pos": token.pos_,
        "tag": token.tag_,
        "dep": token.dep_,
        "head": token.head.i,
        "morph": str(token.morph),
        "sentStart": bool(token.is_sent_start),
    }


def send(message):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    nlp = load_model()
    send({"ready": True, "spacy": spacy.__version__, "model": f"{nlp.meta['name']}-{nlp.meta['version']}"})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            doc = nlp(str(request.get("text", ""))[:2000])
            send({"id": request_id, "tokens": [token_json(t) for t in doc]})
        except Exception as error:  # el proceso sigue vivo aunque falle un pedido
            send({"id": request_id, "error": str(error)})


if __name__ == "__main__":
    main()
