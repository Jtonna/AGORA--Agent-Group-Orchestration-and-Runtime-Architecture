/**
 * Health check route.
 *
 * GET /health - Returns 200 OK with { status: 'ok' }.
 */

import { FastifyInstance } from 'fastify';
import { validateQueryParams } from '../middleware/validation.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (request, reply) => {
    validateQueryParams(request, []);
    return reply.code(200).send({ status: 'ok' });
  });
}
