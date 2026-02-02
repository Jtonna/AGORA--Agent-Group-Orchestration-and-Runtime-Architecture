/**
 * Mail inbox and send routes.
 *
 * GET  /mail - Paginated inbox for a viewer.
 * POST /mail - Send a new email.
 *
 * Ported from the-corporations-email/app.py (get_inbox, send_email).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors.js';
import { EMAIL_NOT_FOUND, INVALID_FIELD, INVALID_PAGE, PARENT_NOT_FOUND } from '../errors.js';
import { Email, normalizeName } from '../models.js';
import { getStorage } from '../storage.js';
import {
  getInboxForViewer, paginateInbox, getReadStatus,
  PaginationError, getAllKnownAgents,
} from '../services.js';
import {
  validateQueryParams, validateContentType, getJsonBody,
  validateViewerParam, validatePageParam, validateEmailBody,
} from '../middleware/validation.js';

export async function mailRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /mail  -  inbox
  // ---------------------------------------------------------------------------
  fastify.get('/mail', async (request: FastifyRequest, reply: FastifyReply) => {
    validateQueryParams(request, ['viewer', 'page']);

    const viewer = validateViewerParam(request);
    const page = validatePageParam(request, 'page', 1);

    const storage = getStorage();
    const emails = getInboxForViewer(viewer, storage);

    // Paginate
    let result;
    try {
      result = paginateInbox(emails, page);
    } catch (err: unknown) {
      if (err instanceof PaginationError) {
        throw new AppError(err.message, INVALID_PAGE);
      }
      throw err;
    }

    // Augment each email dict for inbox view
    for (const emailDict of result.data as Record<string, unknown>[]) {
      const emailId = emailDict.id as string;
      const email = storage.getById(emailId);
      if (email) {
        emailDict.read = getReadStatus(email, viewer);
      } else {
        emailDict.read = false;
      }

      // Strip fields that don't belong in the inbox summary
      delete emailDict.content;
      delete emailDict.readBy;
      delete emailDict.deletedBy;
    }

    return reply.code(200).send(result);
  });

  // ---------------------------------------------------------------------------
  // POST /mail  -  send
  // ---------------------------------------------------------------------------
  fastify.post('/mail', async (request: FastifyRequest, reply: FastifyReply) => {
    validateQueryParams(request, []);
    validateContentType(request);

    const data = getJsonBody(request);
    const validatedData = validateEmailBody(data);

    const storage = getStorage();

    // ------ "everyone" expansion ------------------------------------------
    const toList = validatedData.to as string[];
    const hasEveryone = toList.some((name: string) => name.toLowerCase() === 'everyone');

    if (hasEveryone) {
      const allAgents = getAllKnownAgents(storage);
      const sender = (validatedData.from as string).toLowerCase();

      // Build expanded list: non-"everyone" entries first, then all agents (minus sender)
      const expanded: string[] = toList.filter((name: string) => name.toLowerCase() !== 'everyone');
      for (const agent of allAgents) {
        if (agent !== sender) {
          expanded.push(agent);
        }
      }

      // Deduplicate while preserving order
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const name of expanded) {
        const lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          deduped.push(name);
        }
      }
      validatedData.to = deduped;

      if ((validatedData.to as string[]).length === 0) {
        throw new AppError('No known agents to broadcast to', INVALID_FIELD);
      }
    }

    // ------ Parent validation (reply) -------------------------------------
    const isResponseTo = (validatedData.isResponseTo as string | null | undefined) ?? null;
    if (isResponseTo) {
      const parent = storage.getById(isResponseTo);
      if (parent === null) {
        throw new AppError(
          `Parent email with id '${isResponseTo}' not found`,
          PARENT_NOT_FOUND,
        );
      }
    }

    // ------ Auto-prefix "Re: " for replies --------------------------------
    let subject = validatedData.subject as string;
    if (isResponseTo && !subject.toLowerCase().startsWith('re:')) {
      subject = `Re: ${subject}`;
    }

    // ------ Create and store the email ------------------------------------
    const email = new Email({
      to: validatedData.to as string[],
      from: validatedData.from as string,
      subject,
      content: validatedData.content as string,
      isResponseTo: isResponseTo ?? undefined,
    });

    // Auto-mark as read for sender
    email.markReadBy(validatedData.from as string);

    storage.create(email);

    return reply.code(201).send({
      id: email.id,
      message: 'Email sent successfully',
    });
  });
}
