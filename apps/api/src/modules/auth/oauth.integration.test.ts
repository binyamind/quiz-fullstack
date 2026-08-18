import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.ts';
import { createDb, createPool } from '../../infra/db.ts';
import { migrate } from '../../infra/migrate.ts';
import { truncateAll, TEST_JWT_SECRET } from '../../test/harness.ts';
import type { DB } from '../../infra/db.ts';
import type { Pool } from 'pg';
import { createGitHubProvider, type OAuthProfile } from './github.ts';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/concentrate-quiz';

/** A provider that skips the network but keeps the real state/link logic. */
function fakeProvider(profile: OAuthProfile) {
  return {
    name: 'github',
    authorizeUrl: (state: string) =>
      `https://github.test/authorize?state=${state}`,
    exchange: async (code: string) => {
      if (code !== 'good-code') throw new Error('bad code');
      return profile;
    },
  };
}

const PROFILE: OAuthProfile = {
  providerUserId: '424242',
  email: 'octocat@github.test',
  name: 'Octo Cat',
};

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
    oauthProvider: fakeProvider(PROFILE),
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

beforeEach(async () => {
  await truncateAll(pool);
});

async function startFlow() {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v0/auth/oauth/github/start',
  });
  const stateCookie = response.cookies.find((c) => c.name === 'oauth_state');
  return { response, state: stateCookie?.value as string };
}

describe('GET /auth/oauth/github/start', () => {
  it('redirects to the provider and stores the state in a cookie', async () => {
    const { response, state } = await startFlow();

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(`state=${state}`);
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('GET /auth/oauth/github/callback', () => {
  it('provisions a new user on first sign-in and issues a session', async () => {
    const { state } = await startFlow();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v0/auth/oauth/github/callback?code=good-code&state=${state}`,
      headers: { cookie: `oauth_state=${state}` },
    });

    expect(response.statusCode).toBe(302);
    expect(
      response.cookies.find((c) => c.name === 'access_token')
    ).toBeDefined();

    const created = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', PROFILE.email)
      .executeTakeFirstOrThrow();
    expect(created).toMatchObject({ role: 'student', passwordHash: null });
  });

  it('reuses the same user on a second sign-in', async () => {
    const first = await startFlow();
    await app.inject({
      method: 'GET',
      url: `/api/v0/auth/oauth/github/callback?code=good-code&state=${first.state}`,
      headers: { cookie: `oauth_state=${first.state}` },
    });

    const second = await startFlow();
    await app.inject({
      method: 'GET',
      url: `/api/v0/auth/oauth/github/callback?code=good-code&state=${second.state}`,
      headers: { cookie: `oauth_state=${second.state}` },
    });

    const users = await db.selectFrom('users').selectAll().execute();
    const identities = await db
      .selectFrom('oauthIdentities')
      .selectAll()
      .execute();
    expect(users).toHaveLength(1);
    expect(identities).toHaveLength(1);
  });

  it('links the identity to an existing account with the same email', async () => {
    const existing = await db
      .insertInto('users')
      .values({
        email: PROFILE.email,
        name: 'Existing Teacher',
        role: 'teacher',
        passwordHash: null,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const { state } = await startFlow();
    await app.inject({
      method: 'GET',
      url: `/api/v0/auth/oauth/github/callback?code=good-code&state=${state}`,
      headers: { cookie: `oauth_state=${state}` },
    });

    const identity = await db
      .selectFrom('oauthIdentities')
      .selectAll()
      .executeTakeFirstOrThrow();
    // Keeps the teacher role rather than downgrading them to the default.
    expect(identity.userId).toBe(existing.id);
  });

  it('rejects a mismatched state (forged callback)', async () => {
    const { state } = await startFlow();

    const response = await app.inject({
      method: 'GET',
      url: `/api/v0/auth/oauth/github/callback?code=good-code&state=${state}`,
      headers: { cookie: `oauth_state=some-other-state` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toMatch(/state/i);
  });

  it('rejects a callback with no state cookie at all', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v0/auth/oauth/github/callback?code=good-code&state=abc123',
    });
    expect(response.statusCode).toBe(401);
  });

  it('refuses to sign in a suspended account', async () => {
    await db
      .insertInto('users')
      .values({
        email: PROFILE.email,
        name: 'Banned',
        role: 'student',
        passwordHash: null,
        suspended: true,
      })
      .execute();

    const { state } = await startFlow();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v0/auth/oauth/github/callback?code=good-code&state=${state}`,
      headers: { cookie: `oauth_state=${state}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('GitHub provider', () => {
  it('falls back to the verified email list when the profile hides its email', async () => {
    const calls: string[] = [];
    const provider = createGitHubProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost/cb',
      fetchImpl: (async (url: string) => {
        calls.push(String(url));
        if (String(url).includes('access_token')) {
          return new Response(JSON.stringify({ access_token: 'tok' }), {
            status: 200,
          });
        }
        if (String(url).endsWith('/user')) {
          return new Response(
            JSON.stringify({ id: 7, login: 'ghost', name: null, email: null }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify([
            { email: 'unverified@test', primary: true, verified: false },
            { email: 'real@test', primary: false, verified: true },
          ]),
          { status: 200 }
        );
      }) as unknown as typeof fetch,
    });

    const profile = await provider.exchange('code');

    expect(profile).toEqual({
      providerUserId: '7',
      email: 'real@test',
      name: 'ghost',
    });
    expect(calls.some((c) => c.endsWith('/user/emails'))).toBe(true);
  });

  it('rejects an authorization code the provider refuses', async () => {
    const provider = createGitHubProvider({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost/cb',
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ error_description: 'bad verification code' }),
          {
            status: 200,
          }
        )) as unknown as typeof fetch,
    });

    await expect(provider.exchange('nope')).rejects.toThrow(
      /bad verification code/
    );
  });
});
