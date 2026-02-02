/**
 * Mail detail and delete routes.
 *
 * GET    /mail/:mailId - Email detail with thread.
 * DELETE /mail/:mailId - Soft-delete an email for a viewer.
 *
 * Ported from the-corporations-email/app.py (get_email_detail, delete_email).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors.js';
import {
  EMAIL_NOT_FOUND, EMAIL_DELETED, NOT_PARTICIPANT, INVALID_PAGE,
} from '../errors.js';
import { getStorage } from '../storage.js';
import {
  buildThread, markAsRead, markAsDeleted,
  paginateThread, getReadStatus, PaginationError,
} from '../services.js';
import {
  validateQueryParams, validateViewerParam, validatePageParam,
  validateUuidParam,
} from '../middleware/validation.js';

// Params shape for /mail/:mailId
interface MailIdParams {
  mailId: string;
}

export async function mailDetailRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /mail/:mailId  -  email detail + thread
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: MailIdParams }>(
    '/mail/:mailId',
    async (request: FastifyRequest<{ Params: MailIdParams }>, reply: FastifyReply) => {
      validateQueryParams(request, ['viewer', 'thread_page']);

      const viewer = validateViewerParam(request);
      const mailId = validateUuidParam(request.params.mailId, 'mailId');
      const threadPage = validatePageParam(request, 'thread_page', 1);

      const storage = getStorage();

      // Fetch the email
      const email = storage.getById(mailId);
      if (email === null) {
        throw new AppError(`Email with id '${mailId}' not found`, EMAIL_NOT_FOUND);
      }

      // Check soft-delete status for this viewer
      if (email.isDeletedFor(viewer)) {
        throw new AppError(`Email with id '${mailId}' has been deleted`, EMAIL_DELETED);
      }

      // Side-effect: mark as read
      markAsRead(mailId, viewer, storage);

      // Build thread (excluding the requested email itself)
      const [, threadEmails] = buildThread(mailId, storage);

      // Paginate the thread
      let threadResult;
      try {
        threadResult = paginateThread(threadEmails, threadPage);
      } catch (err: unknown) {
        if (err instanceof PaginationError) {
          throw new AppError(err.message, INVALID_PAGE);
        }
        throw err;
      }

      // Build the email dict with read status, strip internal arrays
      const emailDict: Record<string, unknown> = email.toDict() as unknown as Record<string, unknown>;
      emailDict.read = getReadStatus(email, viewer);
      delete emailDict.readBy;
      delete emailDict.deletedBy;

      // Build thread summaries (only keep identifying fields)
      const threadSummaries = (threadResult.data as Record<string, unknown>[]).map(
        (d) => ({
          id: d.id,
          from: d.from,
          to: d.to,
          subject: d.subject,
          timestamp: d.timestamp,
          isResponseTo: d.isResponseTo,
        }),
      );

      return reply.code(200).send({
        email: emailDict,
        thread: threadSummaries,
        thread_pagination: {
          page: threadResult.pagination.page,
          per_page: threadResult.pagination.per_page,
          total_in_thread: threadResult.pagination.total_items,
          total_pages: threadResult.pagination.total_pages,
          has_next: threadResult.pagination.has_next,
          has_prev: threadResult.pagination.has_prev,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /mail/:mailId  -  soft-delete for viewer
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: MailIdParams }>(
    '/mail/:mailId',
    async (request: FastifyRequest<{ Params: MailIdParams }>, reply: FastifyReply) => {
      validateQueryParams(request, ['viewer']);

      const viewer = validateViewerParam(request);
      const mailId = validateUuidParam(request.params.mailId, 'mailId');

      const storage = getStorage();

      const email = storage.getById(mailId);
      if (email === null) {
        throw new AppError(`Email with id '${mailId}' not found`, EMAIL_NOT_FOUND);
      }

      if (!email.isParticipant(viewer)) {
        throw new AppError(
          `User '${viewer}' is not a participant in email '${mailId}'`,
          NOT_PARTICIPANT,
        );
      }

      markAsDeleted(mailId, viewer, storage);

      return reply.code(200).send({ message: 'Email deleted' });
    },
  );
}
