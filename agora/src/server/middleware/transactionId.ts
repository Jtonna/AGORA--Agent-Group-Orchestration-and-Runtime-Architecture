import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';

export async function transactionIdPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('transactionId', '');

  fastify.addHook('onRequest', async (request) => {
    request.transactionId = crypto.randomBytes(4).toString('hex');
  });
}

// Augment Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    transactionId: string;
  }
}
