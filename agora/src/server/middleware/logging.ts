import { FastifyInstance } from 'fastify';

function getTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

function logMessage(transactionId: string, level: string, message: string): void {
  const ts = getTimestamp();
  process.stdout.write(`[${ts}] [${transactionId}] [${level}] ${message}\n`);
}

export async function loggingPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request) => {
    const txId = request.transactionId || '--------';
    logMessage(txId, 'INFO', `REQUEST: ${request.method} ${request.url}`);

    const queryString = request.url.split('?')[1];
    if (queryString) {
      logMessage(txId, 'INFO', `QUERY: ${queryString}`);
    }

    if (request.body) {
      logMessage(txId, 'INFO', `BODY: ${JSON.stringify(request.body)}`);
    }
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const txId = request.transactionId || '--------';
    let payloadStr = typeof payload === 'string' ? payload : '';
    if (payloadStr.length > 1000) {
      payloadStr = payloadStr.substring(0, 1000) + '...[truncated]';
    }
    logMessage(txId, 'INFO', `RESPONSE: ${reply.statusCode} ${payloadStr}`);
    return payload;
  });
}

// Export for use in route handlers
export { logMessage, getTimestamp };
