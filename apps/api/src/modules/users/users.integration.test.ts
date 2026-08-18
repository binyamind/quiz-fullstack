import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asUser,
  createTestContext,
  seedUser,
  truncateAll,
  type TestContext,
} from '../../test/harness.ts';

let ctx: TestContext;
let admin: { cookie: string };

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await truncateAll(ctx.pool);
  admin = await asUser(ctx.app, ctx.db, 'admin');
});

const post = (url: string, payload: unknown) =>
  ctx.app.inject({ method: 'POST', url, headers: { cookie: admin.cookie }, payload });
const get = (url: string) =>
  ctx.app.inject({ method: 'GET', url, headers: { cookie: admin.cookie } });
const patch = (url: string, payload?: unknown) =>
  ctx.app.inject({ method: 'PATCH', url, headers: { cookie: admin.cookie }, payload });
const del = (url: string) =>
  ctx.app.inject({ method: 'DELETE', url, headers: { cookie: admin.cookie } });

describe('POST /users', () => {
  it('creates a user and never echoes the password', async () => {
    const response = await post('/api/v0/users', {
      email: 'New.Teacher@School.test',
      name: '  Tina Teacher  ',
      role: 'teacher',
      password: 'a-good-password',
    });

    expect(response.statusCode).toBe(201);
    // Zod normalises the email and trims the name.
    expect(response.json()).toMatchObject({
      email: 'new.teacher@school.test',
      name: 'Tina Teacher',
      role: 'teacher',
      suspended: false,
    });
    expect(response.body).not.toContain('password');
  });

  it('allows an account with no password (OAuth-only)', async () => {
    const response = await post('/api/v0/users', {
      email: 'oauth@school.test',
      name: 'OAuth Only',
      role: 'student',
    });
    expect(response.statusCode).toBe(201);
  });

  it('rejects a duplicate email with 409', async () => {
    await post('/api/v0/users', {
      email: 'dupe@school.test',
      name: 'First',
      role: 'student',
    });
    const second = await post('/api/v0/users', {
      email: 'dupe@school.test',
      name: 'Second',
      role: 'student',
    });

    expect(second.statusCode).toBe(409);
  });

  it.each([
    ['bad email', { email: 'not-an-email', name: 'X', role: 'student' }],
    ['bad role', { email: 'a@b.test', name: 'X', role: 'principal' }],
    ['empty name', { email: 'a@b.test', name: '', role: 'student' }],
    ['short password', { email: 'a@b.test', name: 'X', role: 'student', password: 'abc' }],
  ])('rejects %s with 400', async (_label, payload) => {
    const response = await post('/api/v0/users', payload);
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /users', () => {
  beforeEach(async () => {
    await seedUser(ctx.db, { role: 'teacher', name: 'Alice Teacher', email: 'alice@s.test' });
    await seedUser(ctx.db, { role: 'student', name: 'Bob Student', email: 'bob@s.test' });
    await seedUser(ctx.db, { role: 'student', name: 'Carol Student', email: 'carol@s.test' });
  });

  it('lists every user with pagination metadata', async () => {
    const response = await get('/api/v0/users');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.length).toBe(4); // 3 seeded + the admin
    expect(body).toMatchObject({ limit: 50, offset: 0 });
  });

  it('filters by role', async () => {
    const response = await get('/api/v0/users?role=student');
    expect(response.json().data).toHaveLength(2);
  });

  it('searches name and email case-insensitively', async () => {
    const byName = await get('/api/v0/users?search=alice');
    const byEmail = await get('/api/v0/users?search=CAROL@s.test');

    expect(byName.json().data[0].name).toBe('Alice Teacher');
    expect(byEmail.json().data[0].name).toBe('Carol Student');
  });

  it('filters by suspended state', async () => {
    const [target] = (await get('/api/v0/users?role=student')).json().data;
    await patch(`/api/v0/users/${target.id}/suspend`);

    const suspended = await get('/api/v0/users?suspended=true');
    const active = await get('/api/v0/users?suspended=false');

    expect(suspended.json().data).toHaveLength(1);
    expect(active.json().data).toHaveLength(3);
  });

  it('honours limit and offset', async () => {
    const page = await get('/api/v0/users?limit=2&offset=1');
    expect(page.json().data).toHaveLength(2);
    expect(page.json()).toMatchObject({ limit: 2, offset: 1 });
  });

  it('rejects an out-of-range limit', async () => {
    const response = await get('/api/v0/users?limit=500');
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /users/:id', () => {
  it('returns one user', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const response = await get(`/api/v0/users/${user.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(user.id);
  });

  it('404s for a missing user', async () => {
    const response = await get('/api/v0/users/00000000-0000-0000-0000-000000000000');
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /users/:id', () => {
  it('updates the fields provided', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const response = await patch(`/api/v0/users/${user.id}`, { name: 'Renamed' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Renamed', role: 'student' });
  });

  it('promotes a student to teacher', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const response = await patch(`/api/v0/users/${user.id}`, { role: 'teacher' });
    expect(response.json().role).toBe('teacher');
  });

  it('rejects an email already taken by someone else', async () => {
    const first = await seedUser(ctx.db, { role: 'student', email: 'taken@s.test' });
    const second = await seedUser(ctx.db, { role: 'student' });

    const response = await patch(`/api/v0/users/${second.id}`, { email: first.email });
    expect(response.statusCode).toBe(409);
  });

  it('allows re-setting a user to their own email', async () => {
    const user = await seedUser(ctx.db, { role: 'student', email: 'self@s.test' });
    const response = await patch(`/api/v0/users/${user.id}`, { email: 'self@s.test' });
    expect(response.statusCode).toBe(200);
  });

  it('rejects an empty patch', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const response = await patch(`/api/v0/users/${user.id}`, {});
    expect(response.statusCode).toBe(400);
  });

  it('404s for a missing user', async () => {
    const response = await patch('/api/v0/users/00000000-0000-0000-0000-000000000000', {
      name: 'Ghost',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('suspension', () => {
  it('suspends and unsuspends', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });

    const suspended = await patch(`/api/v0/users/${user.id}/suspend`);
    expect(suspended.json().suspended).toBe(true);

    const restored = await patch(`/api/v0/users/${user.id}/unsuspend`);
    expect(restored.json().suspended).toBe(false);
  });

  it('404s when suspending a missing user', async () => {
    const response = await patch(
      '/api/v0/users/00000000-0000-0000-0000-000000000000/suspend'
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s when unsuspending a missing user', async () => {
    const response = await patch(
      '/api/v0/users/00000000-0000-0000-0000-000000000000/unsuspend'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('PUT /users/:id/password', () => {
  it('sets a password the user can then log in with', async () => {
    const created = await post('/api/v0/users', {
      email: 'nopass@school.test',
      name: 'No Password',
      role: 'student',
    });

    const set = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v0/users/${created.json().id}/password`,
      headers: { cookie: admin.cookie },
      payload: { password: 'brand-new-password' },
    });
    expect(set.statusCode).toBe(204);

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/auth/login',
      payload: { email: 'nopass@school.test', password: 'brand-new-password' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('404s for a missing user', async () => {
    const response = await ctx.app.inject({
      method: 'PUT',
      url: '/api/v0/users/00000000-0000-0000-0000-000000000000/password',
      headers: { cookie: admin.cookie },
      payload: { password: 'brand-new-password' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects a short password', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v0/users/${user.id}/password`,
      headers: { cookie: admin.cookie },
      payload: { password: 'short' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('DELETE /users/:id', () => {
  it('deletes a user', async () => {
    const user = await seedUser(ctx.db, { role: 'student' });

    const response = await del(`/api/v0/users/${user.id}`);
    expect(response.statusCode).toBe(204);

    const after = await get(`/api/v0/users/${user.id}`);
    expect(after.statusCode).toBe(404);
  });

  it('404s for a missing user', async () => {
    const response = await del('/api/v0/users/00000000-0000-0000-0000-000000000000');
    expect(response.statusCode).toBe(404);
  });

  it('refuses to delete a teacher who still owns a class', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    await post('/api/v0/classes', { name: 'Physics', teacherId: teacher.id });

    // classes.teacher_id is ON DELETE RESTRICT, surfaced as a 409 by the
    // foreign-key branch of the error handler.
    const response = await del(`/api/v0/users/${teacher.id}`);
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
