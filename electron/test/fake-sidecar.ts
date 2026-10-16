/**
 * Motor falso para probar SidecarClient sin Java: habla el mismo protocolo (una línea JSON por mensaje).
 *   echo → devuelve los argumentos · bytes → devuelve "RIFF" en base64 · error → responde con error
 *   silencio → no responde nunca · salir → termina con código 3
 */
import { createInterface } from 'node:readline';

const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);

console.log('una línea que no es del protocolo');
send({ ready: true, version: 'falsa' });

createInterface({ input: process.stdin }).on('line', (line) => {
  const { id, channel, args } = JSON.parse(line) as { id: number; channel: string; args: unknown[] };
  switch (channel) {
    case 'echo':
      return send({ id, result: args });
    case 'bytes':
      return send({ id, bytes: Buffer.from('RIFF').toString('base64') });
    case 'error':
      return send({ id, error: 'Se esperaba un texto' });
    case 'silencio':
      return undefined;
    case 'salir':
      return process.exit(3);
    default:
      return send({ id, error: `Canal desconocido: ${channel}` });
  }
});
