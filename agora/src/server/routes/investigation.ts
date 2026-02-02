/**
 * Investigation route.
 *
 * GET /investigation/:name - All emails for a person (including deleted).
 *
 * Ported from the-corporations-email/app.py (get_investigation).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors.js';
import { INVALID_PAGE } from '../errors.js';
import { getStorage } from '../storage.js';
import { paginateInvestigation, PaginationError } from '../services.js';
import {
  validateQueryParams, validatePageParam, validateNameParam,
} from '../middleware/validation.js';

// Params shape for /investigation/:name
interface NameParams {
  name: string;
}

export async function investigationRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /investigation/:name
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: NameParams }>(
    '/investigation/:name',
    async (request: FastifyRequest<{ Params: NameParams }>, reply: FastifyReply) => {
      validateQueryParams(request, ['page']);

      const name = validateNameParam(request.params.name);
      const page = validatePageParam(request, 'page', 1);

      const storage = getStorage();

      // Get ALL emails (no viewer filtering, no delete filtering)
      const allEmails = storage.getAll();

      // Filter: name is a recipient or the sender
      const matchingEmails = allEmails.filter((email) => {
        const isRecipient = email.to.includes(name);
        const isSender = email.from === name;
        return isRecipient || isSender;
      });

      // Sort by timestamp descending (most recent first)
      matchingEmails.sort((a, b) =>
        a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0,
      );

      // Convert to plain dicts before paginating
      const dicts = matchingEmails.map((email) => email.toDict());

      // Paginate
      let result;
      try {
        result = paginateInvestigation(dicts, page);
      } catch (err: unknown) {
        if (err instanceof PaginationError) {
          throw new AppError(err.message, INVALID_PAGE);
        }
        throw err;
      }

      return reply.code(200).send(result);
    },
  );
}
