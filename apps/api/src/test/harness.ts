import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { buildApp } from '../app.ts';
import { createDb, createPool, type DB } from '../infra/db.ts';
import { migrate } from '../infra/migrate.ts';
import { hashPassword } from '../shared/password.ts';
import type { Role } from '../infra/schema.ts';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/concentrate-quiz';

export const TEST_JWT_SECRET = 'test-secret-at-least-32-characters-long';

export interface TestContext {
  app: FastifyInstance;
  db: DB;
  pool: Pool;
  close(): Promise<void>;
}

/**
 * Builds the real app against the compose Postgres (Testcontainers is not in the
 * locked dependency list) with the in-memory session store, so tests need no
 * Redis. Requests go through `app.inject()` — no port, no network.
 */
export async function createTestContext(): Promise<TestContext> {
  const pool = createPool(DATABASE_URL);
  const db = createDb(pool);
  await migrate(pool);

  const app = await buildApp({
    db,
    auth: { jwtSecret: TEST_JWT_SECRET },
  });
  await app.ready();

  return {
    app,
    db,
    pool,
    async close() {
      await app.close();
      await db.destroy();
    },
  };
}

const TABLES = [
  'submissions',
  'assignments',
  'enrollments',
  'classes',
  'teacher_group_members',
  'teacher_groups',
  'oauth_identities',
  'users',
];

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE ${TABLES.join(', ')} CASCADE`);
}

export interface SeededUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  password: string;
}

/** Inserts a user directly, bypassing the admin-only HTTP surface. */
export async function seedUser(
  db: DB,
  overrides: Partial<SeededUser> & { role: Role }
): Promise<SeededUser> {
  const password = overrides.password ?? 'test-password-123';
  const email =
    overrides.email ??
    `${overrides.role}-${Math.round(performance.now() * 1000)}@test.local`;
  const name = overrides.name ?? `${overrides.role} user`;

  const row = await db
    .insertInto('users')
    .values({
      email,
      name,
      role: overrides.role,
      passwordHash: await hashPassword(password),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();

  return { id: row.id, email, name, role: overrides.role, password };
}

/** Logs in over HTTP and returns the cookie header a browser would send back. */
export async function login(
  app: FastifyInstance,
  user: { email: string; password: string }
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v0/auth/login',
    payload: { email: user.email, password: user.password },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed (${response.statusCode}): ${response.body}`);
  }

  return response.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export async function asUser(
  app: FastifyInstance,
  db: DB,
  role: Role
): Promise<{ user: SeededUser; cookie: string }> {
  const user = await seedUser(db, { role });
  return { user, cookie: await login(app, user) };
}
