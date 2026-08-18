import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asUser,
  createTestContext,
  login,
  seedUser,
  truncateAll,
  type TestContext,
} from '../../test/harness.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await truncateAll(ctx.pool);
});

describe('POST /auth/login', () => {
  it('sets httpOnly session cookies and returns the user without the hash', async () => {
    const user = await seedUser(ctx.db, { role: 'teacher' });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      payload: { email: user.email, password: user.password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({
      id: user.id,
      role: 'teacher',
    });
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('scrypt');

    const access = response.cookies.find((c) => c.name === 'access_token');
    const refresh = response.cookies.find((c) => c.name === 'refresh_token');
    expect(access).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    });
    expect(refresh).toMatchObject({ httpOnly: true, path: '/api/v0/auth' });
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });

    const wrongPassword = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      payload: { email: user.email, password: 'not-the-password' },
    });
    const unknownEmail = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      payload: { email: 'nobody@test.local', password: 'whatever-123' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
  });

  it('refuses a suspended account', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    await ctx.db
      .updateTable('users')
      .set({ suspended: true })
      .where('id', '=', user.id)
      .execute();

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      payload: { email: user.email, password: user.password },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toMatch(/suspended/i);
  });

  it('refuses an OAuth-only account that has no password', async () => {
    await ctx.db
      .insertInto('users')
      .values({
        email: 'oauth-only@test.local',
        name: 'OAuth Only',
        role: 'student',
        passwordHash: null,
      })
      .execute();

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      payload: { email: 'oauth-only@test.local', password: 'anything-123' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the signed-in user', async () => {
    const { user, cookie } = await asUser(ctx.app, ctx.db, 'admin');

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/v0/auth/me',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: user.id, role: 'admin' });
  });

  it('rejects a request with no cookie', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/v0/auth/me',
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/v0/auth/me',
      headers: { authorization: 'Bearer not.a.real.token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('stops honouring a session once the account is suspended', async () => {
    const { user, cookie } = await asUser(ctx.app, ctx.db, 'teacher');
    await ctx.db
      .updateTable('users')
      .set({ suspended: true })
      .where('id', '=', user.id)
      .execute();

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/v0/auth/me',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('session lifecycle', () => {
  it('rotates the refresh token and rejects replay of the old one', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const cookie = await login(ctx.app, user);

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/refresh',
      headers: { cookie },
    });
    expect(first.statusCode).toBe(200);

    const replay = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/refresh',
      headers: { cookie },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.message).toMatch(/revoked/i);
  });

  it('revokes the session on logout so refresh stops working', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const cookie = await login(ctx.app, user);

    const logout = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/logout',
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(204);

    const refresh = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/refresh',
      headers: { cookie },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('rejects an access token used as a refresh token', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const cookies = await login(ctx.app, user);
    const accessOnly = cookies
      .split('; ')
      .find((c) => c.startsWith('access_token='))!;

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/refresh',
      headers: { cookie: `refresh_token=${accessOnly.split('=')[1]}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('logs out every device at once', async () => {
    const user = await seedUser(ctx.db, { role: 'teacher' });
    const phone = await login(ctx.app, user);
    const laptop = await login(ctx.app, user);

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/logout-everywhere',
      headers: { cookie: laptop },
    });

    const fromPhone = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/refresh',
      headers: { cookie: phone },
    });
    expect(fromPhone.statusCode).toBe(401);
  });
});

describe('POST /auth/refresh without a session', () => {
  it('rejects a request that carries no refresh cookie', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/refresh',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe('No refresh token');
  });
});
