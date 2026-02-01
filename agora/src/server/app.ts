import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppError } from './errors.js';
import { transactionIdPlugin } from './middleware/transactionId.js';
import { loggingPlugin } from './middleware/logging.js';
import { healthRoutes } from './routes/health.js';
import { mailRoutes } from './routes/mail.js';
import { mailDetailRoutes } from './routes/mailDetail.js';
import { investigationRoutes } from './routes/investigation.js';
import { agentRoutes } from './routes/agents.js';
import { getStorage } from './storage.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  logger?: boolean;
}

/**
 * Build and configure the Fastify application.
 * Does NOT start listening — caller should await app.listen().
 */
export async function buildApp(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  // CORS - allow all origins
  await app.register(cors, { origin: true });

  // Middleware plugins
  await app.register(transactionIdPlugin);
  await app.register(loggingPlugin);

  // Custom content-type parser for JSON that handles edge cases
  // Fastify's default parser rejects empty bodies etc. We need raw control.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    try {
      const parsed = body ? JSON.parse(body as string) : null;
      done(null, parsed);
    } catch (err) {
      done(null, undefined); // Let route validation handle it
    }
  });
  // Accept any content type for POST (validation.ts checks it)
  app.addContentTypeParser('*', { parseAs: 'string' }, (request, body, done) => {
    done(null, body);
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message, code: error.code });
    }

    // Fastify JSON parse errors
    const fastifyError = error as { statusCode?: number; code?: string };
    if (fastifyError.statusCode === 400 && fastifyError.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.code(415).send({
        error: `Unsupported media type. Expected 'application/json; charset=utf-8'`,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }

    // Unknown errors
    console.error('Unexpected error:', error);
    return reply.code(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });

  // Ensure Content-Type charset on JSON responses
  app.addHook('onSend', async (request, reply, payload) => {
    const ct = reply.getHeader('content-type');
    if (typeof ct === 'string' && ct === 'application/json') {
      reply.header('content-type', 'application/json; charset=utf-8');
    }
    return payload;
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(mailRoutes);
  await app.register(mailDetailRoutes);
  await app.register(investigationRoutes);
  await app.register(agentRoutes);

  return app;
}

/**
 * Build the app, initialize storage, and start listening.
 */
export async function startServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const port = options.port ?? 60061;
  const host = options.host ?? '0.0.0.0';

  // Initialize storage
  const storage = getStorage(options.dataDir);
  storage.initialize();

  // Build and start
  const app = await buildApp(options);
  await app.listen({ port, host });

  console.log(`AGORA server listening on http://${host}:${port}`);
  return app;
}
