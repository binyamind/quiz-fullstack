import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from './app.ts';
import { createDb, createPool, type DB } from './infra/db.ts';
import { migrate } from './infra/migrate.ts';
import { createFakeRedis } from './test/fake-redis.ts';
import {
  TEST_JWT_SECRET,
  login,
  seedUser,
  truncateAll,
} from './test/harness.ts';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/concentrate-quiz';

let pool: Pool;
let db: DB;
const opened: FastifyInstance[] = [];

/** Builds an app with the given wiring; every instance is closed after the test. */
async function build(
  options: Partial<Parameters<typeof buildApp>[0]> = {}
): Promise<FastifyInstance> {
  const app = await buildApp({
    db,
    auth: { jwtSecret: TEST_JWT_SECRET },
    ...options,
  });
  await app.ready();
  opened.push(app);
  return app;
}

beforeAll(async () => {
  pool = createPool(DATABASE_URL);
  db = createDb(pool);
  await migrate(pool);
});

afterEach(async () => {
  await Promise.all(opened.splice(0).map((app) => app.close()));
  await truncateAll(pool);
});

afterAll(async () => {
  await db.destroy();
});

describe('health and readiness', () => {
  it('reports liveness without touching any dependency', async () => {
    const app = await build();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports ready when the database answers and no redis is wired', async () => {
    const app = await build();

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
      checks: { database: 'ok' },
    });
  });

  it('checks redis too when one is wired', async () => {
    const app = await build({ redis: createFakeRedis() });

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('degrades to 503 when redis cannot be reached', async () => {
    const redis = createFakeRedis();
    vi.spyOn(redis, 'ping').mockRejectedValue(new Error('connection refused'));
    const app = await build({ redis });

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'degraded',
      checks: { database: 'ok', redis: 'error' },
    });
  });

  it('degrades to 503 when the database cannot be reached', async () => {
    const deadPool = new Pool({
      connectionString: DATABASE_URL.replace(/:\d+\//, ':1/'),
      connectionTimeoutMillis: 500,
    });
    const app = await buildApp({
      db: createDb(deadPool),
      auth: { jwtSecret: TEST_JWT_SECRET },
    });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json().checks.database).toBe('error');

    await app.close();
    await deadPool.end();
  });
});

describe('json body parsing', () => {
  it('treats an empty body as {} so action endpoints need no payload', async () => {
    const app = await build();
    const admin = await seedUser(db, { role: 'admin' });
    const cookie = await login(app, admin);
    const student = await seedUser(db, { role: 'student' });

    // A suspend call carries no body but still declares a JSON content type.
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v0/users/${student.id}/suspend`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: '',
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects a malformed JSON body with a 400', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toBe('Body is not valid JSON');
  });

  it('accepts a well-formed JSON body', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'nobody@test.local',
        password: 'wrong-pass',
      }),
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('stats cache invalidation hook', () => {
  it('clears the stats namespace after a successful write', async () => {
    const cache = {
      wrap: vi.fn(async (_key, _ttl, load) => load()),
      invalidate: vi.fn(async () => {}),
    };
    const app = await build({ cache });
    const admin = await seedUser(db, { role: 'admin' });
    const cookie = await login(app, admin);
    cache.invalidate.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/users',
      headers: { cookie },
      payload: {
        email: 'fresh-teacher@test.local',
        name: 'Fresh Teacher',
        role: 'teacher',
        password: 'password-1234',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(cache.invalidate).toHaveBeenCalledWith('stats:');
  });

  it('leaves the cache alone for reads and for failed writes', async () => {
    const cache = {
      wrap: vi.fn(async (_key, _ttl, load) => load()),
      invalidate: vi.fn(async () => {}),
    };
    const app = await build({ cache });
    const admin = await seedUser(db, { role: 'admin' });
    const cookie = await login(app, admin);
    cache.invalidate.mockClear();

    await app.inject({
      method: 'GET',
      url: '/api/v0/users',
      headers: { cookie },
    });
    expect(cache.invalidate).not.toHaveBeenCalled();

    const failed = await app.inject({
      method: 'POST',
      url: '/api/v0/users',
      headers: { cookie },
      payload: { email: 'not-an-email' },
    });
    expect(failed.statusCode).toBeGreaterThanOrEqual(400);
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('serves the request even when invalidation fails', async () => {
    const cache = {
      wrap: vi.fn(async (_key, _ttl, load) => load()),
      invalidate: vi.fn(async () => {
        throw new Error('redis is down');
      }),
    };
    const app = await build({ cache });
    const admin = await seedUser(db, { role: 'admin' });
    const cookie = await login(app, admin);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/users',
      headers: { cookie },
      payload: {
        email: 'still-created@test.local',
        name: 'Still Created',
        role: 'student',
        password: 'password-1234',
      },
    });

    // The hook runs after the response, so a cache outage must not undo the write.
    expect(response.statusCode).toBe(201);
    await vi.waitFor(() => expect(cache.invalidate).toHaveBeenCalled());
    const created = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', 'still-created@test.local')
      .executeTakeFirst();
    expect(created).toBeDefined();
  });
});

describe('optional wiring', () => {
  it('builds a redis-backed cache and session store when redis is supplied', async () => {
    const redis = createFakeRedis();
    const app = await build({ redis, statsCacheTtlSeconds: 60 });
    const admin = await seedUser(db, { role: 'admin' });

    const cookie = await login(app, admin);
    await app.inject({
      method: 'GET',
      url: '/api/v0/stats/average-grades',
      headers: { cookie },
    });

    // A refresh session id and a cached stats entry both live in redis now.
    const keys = [...redis.store.keys()];
    expect(keys.some((k) => k.startsWith('session:'))).toBe(true);
    expect(keys.some((k) => k.startsWith('stats:'))).toBe(true);
  });

  it('disables the chat routes when no chat config is given', async () => {
    const app = await build();
    const student = await seedUser(db, { role: 'student' });
    const cookie = await login(app, student);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v0/chat/context',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('CHAT_DISABLED');
  });

  it('wires the chat routes from an api key, defaulting the model', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          async json() {
            return {
              content: [{ type: 'text', text: 'Hello from Claude' }],
              usage: { input_tokens: 10, output_tokens: 4 },
            };
          },
        }) as Response
    );
    const app = await build({ chat: { apiKey: 'sk-test', fetchImpl } });
    const student = await seedUser(db, { role: 'student' });
    const cookie = await login(app, student);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v0/chat',
      headers: { cookie },
      payload: { messages: [{ role: 'user', content: 'What is due?' }] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reply).toBe('Hello from Claude');
    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string
    );
    expect(body.model).toBe('claude-opus-5');
  });

  it('honours an explicit chat model', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          async json() {
            return { content: [{ type: 'text', text: 'hi' }], usage: {} };
          },
        }) as Response
    );
    const app = await build({
      chat: { apiKey: 'sk-test', model: 'claude-sonnet-5', fetchImpl },
    });
    const student = await seedUser(db, { role: 'student' });
    const cookie = await login(app, student);

    await app.inject({
      method: 'POST',
      url: '/api/v0/chat',
      headers: { cookie },
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    });

    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string
    );
    expect(body.model).toBe('claude-sonnet-5');
  });

  it('builds the GitHub provider from oauth config', async () => {
    const app = await build({
      auth: {
        jwtSecret: TEST_JWT_SECRET,
        github: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'http://localhost:4000/callback',
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v0/auth/oauth/github/start',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(
      'github.com/login/oauth/authorize'
    );
    expect(response.headers.location).toContain('client_id=client-id');
  });

  it('restricts the cors origin when one is configured', async () => {
    const app = await build({ corsOrigin: 'https://portal.test' });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://portal.test' },
    });

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://portal.test'
    );
  });
});
