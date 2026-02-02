/**
 * Agent directory and spawn routes.
 *
 * GET  /directory/agents - List all registered agents.
 * POST /agents/spawn     - Spawn a new agent with auto-generated name.
 *
 * Ported from the-corporations-email/app.py (get_agents, spawn_agent).
 */

import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors.js';
import { getStorage } from '../storage.js';
import { validateQueryParams } from '../middleware/validation.js';
import {
  uniqueNamesGenerator,
  names as namesDictionary,
} from 'unique-names-generator';

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /directory/agents
  // ---------------------------------------------------------------------------
  fastify.get('/directory/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    validateQueryParams(request, []);

    const storage = getStorage();
    const agentsDict = storage.getAllAgents();

    // Build sorted list
    const agentsList = Object.keys(agentsDict)
      .sort()
      .map((name) => ({
        name,
        pid: agentsDict[name].pid,
        supervisor: agentsDict[name].supervisor,
      }));

    return reply.code(200).send({ agents: agentsList });
  });

  // ---------------------------------------------------------------------------
  // POST /agents/spawn
  // ---------------------------------------------------------------------------
  fastify.post('/agents/spawn', async (request: FastifyRequest, reply: FastifyReply) => {
    validateQueryParams(request, []);

    const storage = getStorage();

    // Parse optional supervisor from body (tolerant of missing/invalid JSON)
    let supervisor: string | null = null;
    try {
      const body = request.body as Record<string, unknown> | null | undefined;
      if (body && typeof body === 'object') {
        const rawSupervisor = body.supervisor;
        if (rawSupervisor && typeof rawSupervisor === 'string') {
          supervisor = rawSupervisor.trim().toLowerCase() || null;
        }
      }
    } catch {
      // Ignore parse failures -- proceed without supervisor
    }

    // Generate a unique name
    const maxAttempts = 100;
    let name: string | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      const baseName = uniqueNamesGenerator({
        dictionaries: [namesDictionary],
        style: 'lowerCase',
        length: 1,
      });

      if (storage.isAgentNameAvailable(baseName)) {
        name = baseName;
        break;
      }

      // Collision -- try again with a random 4-char hex suffix
      const suffix = crypto.randomBytes(2).toString('hex'); // 4 hex chars
      const suffixedName = `${baseName}-${suffix}`;

      if (storage.isAgentNameAvailable(suffixedName)) {
        name = suffixedName;
        break;
      }
    }

    if (name === null) {
      throw new AppError(
        'Failed to generate unique agent name',
        'INTERNAL_ERROR' as any, // non-standard code, matches Python behaviour
      );
    }

    storage.registerAgent(name, null, supervisor);

    return reply.code(201).send({ agent_name: name });
  });
}
