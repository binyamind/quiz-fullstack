import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asUser,
  createTestContext,
  seedUser,
  truncateAll,
  type TestContext,
} from '../../test/harness.ts';

let ctx: TestContext;
let cookie: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await truncateAll(ctx.pool);
  cookie = (await asUser(ctx.app, ctx.db, 'admin')).cookie;
});

const call = (method: 'POST' | 'GET' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: { cookie }, payload });

const createGroup = async (payload: unknown) => {
  const response = await call('POST', '/api/v0/teacher-groups', payload);
  expect(response.statusCode).toBe(201);
  return response.json();
};

describe('POST /teacher-groups', () => {
  it('creates an empty group', async () => {
    const group = await createGroup({ name: 'Science Dept' });
    expect(group).toMatchObject({ name: 'Science Dept', members: [] });
  });

  it('creates a group with initial members', async () => {
    const a = await seedUser(ctx.db, { role: 'teacher', name: 'Anna' });
    const b = await seedUser(ctx.db, { role: 'teacher', name: 'Ben' });

    const group = await createGroup({ name: 'Maths Dept', teacherIds: [a.id, b.id] });

    expect(group.members.map((m: { name: string }) => m.name)).toEqual(['Anna', 'Ben']);
  });

  it('accepts a description and stores null when omitted', async () => {
    const withText = await createGroup({ name: 'A', description: 'Physics and chem' });
    const without = await createGroup({ name: 'B' });

    expect(withText.description).toBe('Physics and chem');
    expect(without.description).toBeNull();
  });

  it('rejects a duplicate name with 409', async () => {
    await createGroup({ name: 'Duplicate' });
    const second = await call('POST', '/api/v0/teacher-groups', { name: 'Duplicate' });
    expect(second.statusCode).toBe(409);
  });

  it('rejects a student in the initial member list', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const response = await call('POST', '/api/v0/teacher-groups', {
      name: 'Wrong',
      teacherIds: [student.id],
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toMatch(/not a teacher/i);
  });

  it('rejects an empty name', async () => {
    const response = await call('POST', '/api/v0/teacher-groups', { name: '' });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /teacher-groups', () => {
  it('lists groups alphabetically with pagination', async () => {
    await createGroup({ name: 'Zoology' });
    await createGroup({ name: 'Art' });

    const response = await call('GET', '/api/v0/teacher-groups');
    const body = response.json();

    expect(body.data.map((g: { name: string }) => g.name)).toEqual(['Art', 'Zoology']);
    expect(body).toMatchObject({ limit: 50, offset: 0 });
  });

  it('returns a group with its members', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher', name: 'Tina' });
    const group = await createGroup({ name: 'Science', teacherIds: [teacher.id] });

    const response = await call('GET', `/api/v0/teacher-groups/${group.id}`);
    expect(response.json().members).toHaveLength(1);
  });

  it('404s for a missing group', async () => {
    const response = await call(
      'GET',
      '/api/v0/teacher-groups/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /teacher-groups/:id', () => {
  it('renames a group', async () => {
    const group = await createGroup({ name: 'Old Name' });
    const response = await call('PATCH', `/api/v0/teacher-groups/${group.id}`, {
      name: 'New Name',
    });

    expect(response.json().name).toBe('New Name');
  });

  it('clears a description with null', async () => {
    const group = await createGroup({ name: 'Group', description: 'text' });
    const response = await call('PATCH', `/api/v0/teacher-groups/${group.id}`, {
      description: null,
    });

    expect(response.json().description).toBeNull();
  });

  it('rejects an empty patch', async () => {
    const group = await createGroup({ name: 'Group' });
    const response = await call('PATCH', `/api/v0/teacher-groups/${group.id}`, {});
    expect(response.statusCode).toBe(400);
  });

  it('404s for a missing group', async () => {
    const response = await call(
      'PATCH',
      '/api/v0/teacher-groups/00000000-0000-0000-0000-000000000000',
      { name: 'Ghost' }
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('membership', () => {
  it('adds a member and returns the new roster', async () => {
    const group = await createGroup({ name: 'Science' });
    const teacher = await seedUser(ctx.db, { role: 'teacher', name: 'Tina' });

    const response = await call('POST', `/api/v0/teacher-groups/${group.id}/members`, {
      teacherId: teacher.id,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toHaveLength(1);
  });

  it('is idempotent when adding the same teacher twice', async () => {
    const group = await createGroup({ name: 'Science' });
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    const body = { teacherId: teacher.id };

    await call('POST', `/api/v0/teacher-groups/${group.id}/members`, body);
    const second = await call('POST', `/api/v0/teacher-groups/${group.id}/members`, body);

    expect(second.statusCode).toBe(201);
    expect(second.json().data).toHaveLength(1);
  });

  it('lists members', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    const group = await createGroup({ name: 'Science', teacherIds: [teacher.id] });

    const response = await call('GET', `/api/v0/teacher-groups/${group.id}/members`);
    expect(response.json().data).toHaveLength(1);
  });

  it('removes a member', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    const group = await createGroup({ name: 'Science', teacherIds: [teacher.id] });

    const removed = await call(
      'DELETE',
      `/api/v0/teacher-groups/${group.id}/members/${teacher.id}`
    );
    expect(removed.statusCode).toBe(204);

    const after = await call('GET', `/api/v0/teacher-groups/${group.id}/members`);
    expect(after.json().data).toHaveLength(0);
  });

  it('404s when removing a teacher who is not a member', async () => {
    const group = await createGroup({ name: 'Science' });
    const stranger = await seedUser(ctx.db, { role: 'teacher' });

    const response = await call(
      'DELETE',
      `/api/v0/teacher-groups/${group.id}/members/${stranger.id}`
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s when adding to a missing group', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    const response = await call(
      'POST',
      '/api/v0/teacher-groups/00000000-0000-0000-0000-000000000000/members',
      { teacherId: teacher.id }
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s when listing members of a missing group', async () => {
    const response = await call(
      'GET',
      '/api/v0/teacher-groups/00000000-0000-0000-0000-000000000000/members'
    );
    expect(response.statusCode).toBe(404);
  });

  it('rejects a non-teacher member', async () => {
    const group = await createGroup({ name: 'Science' });
    const student = await seedUser(ctx.db, { role: 'student' });

    const response = await call('POST', `/api/v0/teacher-groups/${group.id}/members`, {
      teacherId: student.id,
    });
    expect(response.statusCode).toBe(409);
  });
});

describe('DELETE /teacher-groups/:id', () => {
  it('deletes a group and cascades its memberships', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    const group = await createGroup({ name: 'Science', teacherIds: [teacher.id] });

    const response = await call('DELETE', `/api/v0/teacher-groups/${group.id}`);
    expect(response.statusCode).toBe(204);

    const members = await ctx.db
      .selectFrom('teacherGroupMembers')
      .selectAll()
      .where('groupId', '=', group.id)
      .execute();
    expect(members).toHaveLength(0);

    // The teacher themselves survives the group being deleted.
    const stillThere = await call('GET', `/api/v0/users/${teacher.id}`);
    expect(stillThere.statusCode).toBe(200);
  });

  it('404s for a missing group', async () => {
    const response = await call(
      'DELETE',
      '/api/v0/teacher-groups/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });
});
