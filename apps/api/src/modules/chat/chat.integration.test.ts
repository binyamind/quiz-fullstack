import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../app.ts';
import { createDb, createPool, type DB } from '../../infra/db.ts';
import { migrate } from '../../infra/migrate.ts';
import { login, seedUser, truncateAll, TEST_JWT_SECRET } from '../../test/harness.ts';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/concentrate-quiz';

/** Captures what the app sends to Anthropic and replies with a canned answer. */
interface FakeCall {
  system: string;
  messages: { role: string; content: string }[];
}

let calls: FakeCall[] = [];
let nextResponse: { status: number; body: unknown } = {
  status: 200,
  body: {
    content: [{ type: 'text', text: 'You have one assignment due.' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 120, output_tokens: 12 },
  },
};

const fakeFetch = (async (_url: string, init: { body: string }) => {
  const payload = JSON.parse(init.body);
  calls.push({ system: payload.system, messages: payload.messages });
  return new Response(JSON.stringify(nextResponse.body), {
    status: nextResponse.status,
    headers: { 'content-type': 'application/json' },
  });
}) as unknown as typeof fetch;

let app: FastifyInstance;
let db: DB;
let pool: Pool;

beforeAll(async () => {
  pool = createPool(DATABASE_URL);
  db = createDb(pool);
  await migrate(pool);
  app = await buildApp({
    db,
    auth: { jwtSecret: TEST_JWT_SECRET },
    chat: { apiKey: 'test-key', model: 'claude-opus-5', fetchImpl: fakeFetch },
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

beforeEach(async () => {
  await truncateAll(pool);
  calls = [];
  nextResponse = {
    status: 200,
    body: {
      content: [{ type: 'text', text: 'You have one assignment due.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 120, output_tokens: 12 },
    },
  };
});

const ask = (cookie: string, content: string) =>
  app.inject({
    method: 'POST',
    url: '/api/v0/chat',
    headers: { cookie },
    payload: { messages: [{ role: 'user', content }] },
  });

async function seedStudentWithWork() {
  const admin = await seedUser(db, { role: 'admin' });
  const adminCookie = await login(app, admin);
  const teacher = await seedUser(db, { role: 'teacher', name: 'Tina Teacher' });
  const student = await seedUser(db, { role: 'student', name: 'Sam Student' });

  const klass = (
    await app.inject({
      method: 'POST',
      url: '/api/v0/classes',
      headers: { cookie: adminCookie },
      payload: { name: 'Physics 101', teacherId: teacher.id, studentIds: [student.id] },
    })
  ).json();

  await app.inject({
    method: 'POST',
    url: `/api/v0/classes/${klass.id}/assignments`,
    headers: { cookie: adminCookie },
    payload: { title: 'Newton lab', published: true, maxGrade: 50 },
  });

  return { student, teacher, adminCookie };
}

describe('POST /chat', () => {
  it('answers and reports usage', async () => {
    const { student } = await seedStudentWithWork();
    const response = await ask(await login(app, student), 'What is due?');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      reply: 'You have one assignment due.',
      usage: { inputTokens: 120, outputTokens: 12 },
    });
  });

  it("grounds the prompt in the student's own classes and assignments", async () => {
    const { student } = await seedStudentWithWork();
    await ask(await login(app, student), 'What is due?');

    const [call] = calls;
    expect(call.system).toContain('Sam Student');
    expect(call.system).toContain('role: student');
    expect(call.system).toContain('Physics 101');
    expect(call.system).toContain('Newton lab');
    expect(call.system).toContain('not submitted');
  });

  it('gives a teacher their own classes instead', async () => {
    const { teacher } = await seedStudentWithWork();
    await ask(await login(app, teacher), 'How many students do I have?');

    expect(calls[0].system).toContain('Classes you teach');
    expect(calls[0].system).toContain('1 students');
  });

  it('gives an admin the school-wide figures', async () => {
    const { adminCookie } = await seedStudentWithWork();
    await ask(adminCookie, 'How is the school doing?');

    expect(calls[0].system).toContain('School-wide average grade');
    expect(calls[0].system).toContain('Teachers (1)');
  });

  it('never puts a password hash in the prompt', async () => {
    const { student } = await seedStudentWithWork();
    await ask(await login(app, student), 'Tell me about me');

    expect(calls[0].system).not.toContain('scrypt');
    expect(calls[0].system).not.toContain('passwordHash');
  });

  it('forwards the conversation history in order', async () => {
    const { student } = await seedStudentWithWork();
    const cookie = await login(app, student);

    await app.inject({
      method: 'POST',
      url: '/api/v0/chat',
      headers: { cookie },
      payload: {
        messages: [
          { role: 'user', content: 'What is due?' },
          { role: 'assistant', content: 'Newton lab.' },
          { role: 'user', content: 'When?' },
        ],
      },
    });

    expect(calls[0].messages).toHaveLength(3);
    expect(calls[0].messages[2]).toEqual({ role: 'user', content: 'When?' });
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/chat',
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['no messages', { messages: [] }],
    ['empty content', { messages: [{ role: 'user', content: '' }] }],
    ['bad role', { messages: [{ role: 'system', content: 'hi' }] }],
    [
      'last message not from the user',
      { messages: [{ role: 'assistant', content: 'hi' }] },
    ],
  ])('rejects %s with 400', async (_label, payload) => {
    const { student } = await seedStudentWithWork();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/chat',
      headers: { cookie: await login(app, student) },
      payload,
    });
    expect(response.statusCode).toBe(400);
  });

  it('surfaces an upstream failure as 502', async () => {
    const { student } = await seedStudentWithWork();
    nextResponse = { status: 500, body: { error: 'overloaded' } };

    const response = await ask(await login(app, student), 'hi');
    expect(response.statusCode).toBe(502);
  });

  it('surfaces a model refusal as 422 rather than an empty answer', async () => {
    const { student } = await seedStudentWithWork();
    nextResponse = {
      status: 200,
      body: { content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' } },
    };

    const response = await ask(await login(app, student), 'do something forbidden');
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('CHAT_REFUSED');
  });
});

describe('GET /chat/context', () => {
  it('exposes the prompt context for debugging', async () => {
    const { student } = await seedStudentWithWork();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v0/chat/context',
      headers: { cookie: await login(app, student) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().context).toContain('Physics 101');
  });
});

describe('when the chatbot is not configured', () => {
  it('returns 503 instead of failing at startup', async () => {
    const bare = await buildApp({ db, auth: { jwtSecret: TEST_JWT_SECRET } });
    await bare.ready();

    const student = await seedUser(db, { role: 'student' });
    const response = await bare.inject({
      method: 'POST',
      url: '/api/v0/chat',
      headers: { cookie: await login(bare, student) },
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('CHAT_DISABLED');
    await bare.close();
  });
});
