import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { getStorage, resetStorage } from '../../src/server/storage.js';
import { FastifyInstance } from 'fastify';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  // Create temp directory for test data
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-test-'));

  // Reset storage singleton
  resetStorage();

  // Initialize storage with test data dir
  const storage = getStorage(dataDir);
  storage.initialize();

  // Build app
  app = await buildApp({ dataDir });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  resetStorage();
  // Clean up temp dir
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: send an email via POST /mail and return the parsed response
// ---------------------------------------------------------------------------
async function sendEmail(payload: Record<string, unknown>) {
  const res = await app.inject({
    method: 'POST',
    url: '/mail',
    headers: { 'content-type': 'application/json' },
    payload,
  });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------
describe('GET /health', () => {
  it('should return 200 { status: ok }', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('should return 400 for unknown query parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/health?foo=bar' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNKNOWN_PARAMETER');
  });
});

// ---------------------------------------------------------------------------
// POST /mail  --  send email
// ---------------------------------------------------------------------------
describe('POST /mail', () => {
  it('should send a basic email and return 201 with id', async () => {
    const { status, body } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Hello',
      content: 'World',
    });
    expect(status).toBe(201);
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('string');
    expect(body.message).toBe('Email sent successfully');
  });

  it('should return 400 MISSING_FIELD when to is missing', async () => {
    const { status, body } = await sendEmail({
      from: 'bob',
      subject: 'Hello',
      content: 'World',
    });
    expect(status).toBe(400);
    expect(body.code).toBe('MISSING_FIELD');
  });

  it('should return 415 when Content-Type is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mail',
      payload: JSON.stringify({
        to: ['alice'],
        from: 'bob',
        subject: 'Hello',
        content: 'World',
      }),
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.statusCode).toBe(415);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('should return 400 UNKNOWN_FIELD for unknown body field', async () => {
    const { status, body } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Hello',
      content: 'World',
      sneaky: true,
    });
    expect(status).toBe(400);
    expect(body.code).toBe('UNKNOWN_FIELD');
  });

  it('should auto-prefix Re: on reply with isResponseTo', async () => {
    // First send a parent email
    const parent = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Original',
      content: 'Body',
    });
    expect(parent.status).toBe(201);
    const parentId = parent.body.id;

    // Reply to the parent
    const reply = await sendEmail({
      to: ['bob'],
      from: 'alice',
      subject: 'Original',
      content: 'Reply body',
      isResponseTo: parentId,
    });
    expect(reply.status).toBe(201);

    // Fetch the reply to verify subject
    const detail = await app.inject({
      method: 'GET',
      url: `/mail/${reply.body.id}?viewer=alice`,
    });
    expect(detail.statusCode).toBe(200);
    const detailBody = JSON.parse(detail.body);
    expect(detailBody.email.subject).toBe('Re: Original');
  });

  it('should return 404 PARENT_NOT_FOUND when replying to nonexistent email', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000000';
    const { status, body } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Reply',
      content: 'Body',
      isResponseTo: fakeId,
    });
    expect(status).toBe(404);
    expect(body.code).toBe('PARENT_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /mail  --  inbox
// ---------------------------------------------------------------------------
describe('GET /mail (inbox)', () => {
  it('should return 200 with empty data array for empty inbox', async () => {
    const res = await app.inject({ method: 'GET', url: '/mail?viewer=alice' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
    expect(body.pagination).toBeDefined();
  });

  it('should show emails for the recipient after sending 2', async () => {
    await sendEmail({ to: ['alice'], from: 'bob', subject: 'S1', content: 'C1' });
    await sendEmail({ to: ['alice'], from: 'carol', subject: 'S2', content: 'C2' });

    const res = await app.inject({ method: 'GET', url: '/mail?viewer=alice' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(2);
  });

  it('should hide deleted emails from inbox', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Delete me',
      content: 'Body',
    });

    // Delete the email as alice
    const del = await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=alice`,
    });
    expect(del.statusCode).toBe(200);

    // Inbox should be empty
    const res = await app.inject({ method: 'GET', url: '/mail?viewer=alice' });
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(0);
  });

  it('should strip content, readBy, deletedBy from inbox items', async () => {
    await sendEmail({ to: ['alice'], from: 'bob', subject: 'S', content: 'body text' });

    const res = await app.inject({ method: 'GET', url: '/mail?viewer=alice' });
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(1);
    const item = body.data[0];
    expect(item).not.toHaveProperty('content');
    expect(item).not.toHaveProperty('readBy');
    expect(item).not.toHaveProperty('deletedBy');
    // Should have summary fields
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('from');
    expect(item).toHaveProperty('to');
    expect(item).toHaveProperty('subject');
    expect(item).toHaveProperty('read');
  });

  it('should return 400 MISSING_VIEWER when viewer is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/mail' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('MISSING_VIEWER');
  });

  it('should paginate: 15 emails -> page 1 has 10, page 2 has 5', async () => {
    // Send 15 emails to alice
    for (let i = 0; i < 15; i++) {
      await sendEmail({
        to: ['alice'],
        from: 'bob',
        subject: `Email ${i}`,
        content: `Content ${i}`,
      });
    }

    const page1 = await app.inject({ method: 'GET', url: '/mail?viewer=alice&page=1' });
    const body1 = JSON.parse(page1.body);
    expect(body1.data.length).toBe(10);
    expect(body1.pagination.page).toBe(1);
    expect(body1.pagination.total_items).toBe(15);
    expect(body1.pagination.total_pages).toBe(2);
    expect(body1.pagination.has_next).toBe(true);
    expect(body1.pagination.has_prev).toBe(false);

    const page2 = await app.inject({ method: 'GET', url: '/mail?viewer=alice&page=2' });
    const body2 = JSON.parse(page2.body);
    expect(body2.data.length).toBe(5);
    expect(body2.pagination.page).toBe(2);
    expect(body2.pagination.has_next).toBe(false);
    expect(body2.pagination.has_prev).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /mail/:id  --  email detail
// ---------------------------------------------------------------------------
describe('GET /mail/:id (detail)', () => {
  it('should return 200 with full content, thread, and thread_pagination', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Detail test',
      content: 'Full content here',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/mail/${sent.id}?viewer=alice`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('thread');
    expect(body).toHaveProperty('thread_pagination');
    expect(body.email.content).toBe('Full content here');
    expect(body.email.id).toBe(sent.id);
  });

  it('should auto-mark email as read when viewed', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Read test',
      content: 'Body',
    });

    // Before viewing, inbox should show read=false for alice
    const inbox1 = await app.inject({ method: 'GET', url: '/mail?viewer=alice' });
    const data1 = JSON.parse(inbox1.body).data;
    const item1 = data1.find((e: any) => e.id === sent.id);
    expect(item1.read).toBe(false);

    // View the email
    await app.inject({
      method: 'GET',
      url: `/mail/${sent.id}?viewer=alice`,
    });

    // After viewing, inbox should show read=true
    const inbox2 = await app.inject({ method: 'GET', url: '/mail?viewer=alice' });
    const data2 = JSON.parse(inbox2.body).data;
    const item2 = data2.find((e: any) => e.id === sent.id);
    expect(item2.read).toBe(true);
  });

  it('should return 410 for deleted email', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Delete me',
      content: 'Body',
    });

    // Delete as alice
    await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=alice`,
    });

    // Attempt to view
    const res = await app.inject({
      method: 'GET',
      url: `/mail/${sent.id}?viewer=alice`,
    });
    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('EMAIL_DELETED');
  });

  it('should return 404 for nonexistent email', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000000';
    const res = await app.inject({
      method: 'GET',
      url: `/mail/${fakeId}?viewer=alice`,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('EMAIL_NOT_FOUND');
  });

  it('should build thread for a reply chain of 3 emails', async () => {
    // Email 1: root
    const { body: e1 } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Thread root',
      content: 'First',
    });

    // Email 2: reply to root
    const { body: e2 } = await sendEmail({
      to: ['bob'],
      from: 'alice',
      subject: 'Thread root',
      content: 'Second',
      isResponseTo: e1.id,
    });

    // Email 3: reply to reply
    const { body: e3 } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Thread root',
      content: 'Third',
      isResponseTo: e2.id,
    });

    // View email 3 and check thread contains email 1 and email 2
    const res = await app.inject({
      method: 'GET',
      url: `/mail/${e3.id}?viewer=bob`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // The email itself should be e3
    expect(body.email.id).toBe(e3.id);

    // Thread should contain the other two emails (e1 and e2)
    const threadIds = body.thread.map((t: any) => t.id);
    expect(threadIds).toContain(e1.id);
    expect(threadIds).toContain(e2.id);
    expect(threadIds.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// DELETE /mail/:id
// ---------------------------------------------------------------------------
describe('DELETE /mail/:id', () => {
  it('should delete an email and return 200', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Del',
      content: 'Body',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=alice`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Email deleted');
  });

  it('should return 403 NOT_PARTICIPANT for non-participant', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Del',
      content: 'Body',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=carol`,
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('NOT_PARTICIPANT');
  });

  it('should return 404 for nonexistent email', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000000';
    const res = await app.inject({
      method: 'DELETE',
      url: `/mail/${fakeId}?viewer=alice`,
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('EMAIL_NOT_FOUND');
  });

  it('should be idempotent: deleting twice returns 200 both times', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Del',
      content: 'Body',
    });

    const res1 = await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=alice`,
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=alice`,
    });
    expect(res2.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /investigation/:name
// ---------------------------------------------------------------------------
describe('GET /investigation/:name', () => {
  it('should include deleted emails', async () => {
    const { body: sent } = await sendEmail({
      to: ['alice'],
      from: 'bob',
      subject: 'Investigate',
      content: 'Body',
    });

    // Delete as alice
    await app.inject({
      method: 'DELETE',
      url: `/mail/${sent.id}?viewer=alice`,
    });

    // Investigation should still show the email
    const res = await app.inject({
      method: 'GET',
      url: '/investigation/alice',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(sent.id);
  });

  it('should paginate results (20 per page)', async () => {
    // Send 25 emails to alice
    for (let i = 0; i < 25; i++) {
      await sendEmail({
        to: ['alice'],
        from: 'bob',
        subject: `Inv ${i}`,
        content: `Content ${i}`,
      });
    }

    const page1 = await app.inject({
      method: 'GET',
      url: '/investigation/alice?page=1',
    });
    const body1 = JSON.parse(page1.body);
    expect(body1.data.length).toBe(20);
    expect(body1.pagination.page).toBe(1);
    expect(body1.pagination.total_items).toBe(25);
    expect(body1.pagination.total_pages).toBe(2);
    expect(body1.pagination.has_next).toBe(true);

    const page2 = await app.inject({
      method: 'GET',
      url: '/investigation/alice?page=2',
    });
    const body2 = JSON.parse(page2.body);
    expect(body2.data.length).toBe(5);
    expect(body2.pagination.page).toBe(2);
    expect(body2.pagination.has_next).toBe(false);
    expect(body2.pagination.has_prev).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /directory/agents
// ---------------------------------------------------------------------------
describe('GET /directory/agents', () => {
  it('should return empty agents list initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/directory/agents' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ agents: [] });
  });

  it('should contain the new agent after spawn', async () => {
    // Spawn an agent
    const spawn = await app.inject({
      method: 'POST',
      url: '/agents/spawn',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(spawn.statusCode).toBe(201);
    const spawnBody = JSON.parse(spawn.body);
    const agentName = spawnBody.agent_name;

    // Verify directory contains the agent
    const res = await app.inject({ method: 'GET', url: '/directory/agents' });
    const body = JSON.parse(res.body);
    const names = body.agents.map((a: any) => a.name);
    expect(names).toContain(agentName);
  });
});

// ---------------------------------------------------------------------------
// POST /agents/spawn
// ---------------------------------------------------------------------------
describe('POST /agents/spawn', () => {
  it('should spawn an agent and return 201 with agent_name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agents/spawn',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('agent_name');
    expect(typeof body.agent_name).toBe('string');
    expect(body.agent_name.length).toBeGreaterThan(0);
  });

  it('should spawn an agent with a supervisor and return 201', async () => {
    // First spawn a supervisor
    const sup = await app.inject({
      method: 'POST',
      url: '/agents/spawn',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    const supName = JSON.parse(sup.body).agent_name;

    // Spawn with supervisor
    const res = await app.inject({
      method: 'POST',
      url: '/agents/spawn',
      headers: { 'content-type': 'application/json' },
      payload: { supervisor: supName },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('agent_name');

    // Verify supervisor in directory
    const dir = await app.inject({ method: 'GET', url: '/directory/agents' });
    const dirBody = JSON.parse(dir.body);
    const spawned = dirBody.agents.find((a: any) => a.name === body.agent_name);
    expect(spawned).toBeDefined();
    expect(spawned.supervisor).toBe(supName);
  });
});
