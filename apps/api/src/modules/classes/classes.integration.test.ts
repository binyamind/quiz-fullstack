import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asUser,
  createTestContext,
  login,
  seedUser,
  truncateAll,
  type SeededUser,
  type TestContext,
} from '../../test/harness.ts';

let ctx: TestContext;
let cookie: string;
let teacher: SeededUser;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await truncateAll(ctx.pool);
  const admin = await asUser(ctx.app, ctx.db, 'admin');
  cookie = admin.cookie;
  teacher = await seedUser(ctx.db, { role: 'teacher', name: 'Tina Teacher' });
});

const call = (method: 'POST' | 'GET' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: { cookie }, payload });

const createClass = async (payload: Record<string, unknown> = {}) => {
  const response = await call('POST', '/api/v0/classes', {
    name: 'Physics 101',
    teacherId: teacher.id,
    ...payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json();
};

describe('POST /classes', () => {
  it('creates a class and returns the teacher plus an empty roster', async () => {
    const created = await createClass();

    expect(created).toMatchObject({ name: 'Physics 101', students: [] });
    expect(created.teacher).toMatchObject({ id: teacher.id, role: 'teacher' });
    expect(created.teacher).not.toHaveProperty('passwordHash');
  });

  it('enrols initial students', async () => {
    const student = await seedUser(ctx.db, { role: 'student', name: 'Sam' });
    const created = await createClass({ studentIds: [student.id] });

    expect(created.students).toHaveLength(1);
  });

  it('rejects a non-teacher as the teacher', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const response = await call('POST', '/api/v0/classes', {
      name: 'Bad',
      teacherId: student.id,
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects a teacher in the student list', async () => {
    const other = await seedUser(ctx.db, { role: 'teacher' });
    const response = await call('POST', '/api/v0/classes', {
      name: 'Bad',
      teacherId: teacher.id,
      studentIds: [other.id],
    });

    expect(response.statusCode).toBe(409);
  });

  it('404s when the teacher does not exist', async () => {
    const response = await call('POST', '/api/v0/classes', {
      name: 'Ghost class',
      teacherId: '00000000-0000-0000-0000-000000000000',
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects a malformed teacherId', async () => {
    const response = await call('POST', '/api/v0/classes', {
      name: 'Bad',
      teacherId: 'not-a-uuid',
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /classes', () => {
  it('filters by teacher', async () => {
    const other = await seedUser(ctx.db, { role: 'teacher' });
    await createClass({ name: 'Mine' });
    await call('POST', '/api/v0/classes', { name: 'Theirs', teacherId: other.id });

    const response = await call('GET', `/api/v0/classes?teacherId=${teacher.id}`);
    expect(response.json().data.map((c: { name: string }) => c.name)).toEqual(['Mine']);
  });

  it('filters by student', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    await createClass({ name: 'Enrolled', studentIds: [student.id] });
    await createClass({ name: 'Not enrolled' });

    const response = await call('GET', `/api/v0/classes?studentId=${student.id}`);
    expect(response.json().data.map((c: { name: string }) => c.name)).toEqual(['Enrolled']);
  });

  it('returns a class with its full roster', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const klass = await createClass({ studentIds: [student.id] });

    const response = await call('GET', `/api/v0/classes/${klass.id}`);
    expect(response.json().students).toHaveLength(1);
  });

  it('404s for a missing class', async () => {
    const response = await call(
      'GET',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /classes/:id', () => {
  it('renames a class', async () => {
    const klass = await createClass();
    const response = await call('PATCH', `/api/v0/classes/${klass.id}`, {
      name: 'Physics 201',
    });

    expect(response.json().name).toBe('Physics 201');
  });

  it('reassigns the class to another teacher', async () => {
    const klass = await createClass();
    const replacement = await seedUser(ctx.db, { role: 'teacher' });

    const response = await call('PATCH', `/api/v0/classes/${klass.id}`, {
      teacherId: replacement.id,
    });

    expect(response.json().teacherId).toBe(replacement.id);
  });

  it('refuses to reassign to a student', async () => {
    const klass = await createClass();
    const student = await seedUser(ctx.db, { role: 'student' });

    const response = await call('PATCH', `/api/v0/classes/${klass.id}`, {
      teacherId: student.id,
    });
    expect(response.statusCode).toBe(409);
  });

  it('404s for a missing class', async () => {
    const response = await call(
      'PATCH',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000',
      { name: 'Ghost' }
    );
    expect(response.statusCode).toBe(404);
  });

  it('rejects an empty patch', async () => {
    const klass = await createClass();
    const response = await call('PATCH', `/api/v0/classes/${klass.id}`, {});
    expect(response.statusCode).toBe(400);
  });
});

describe('enrolment', () => {
  it('enrols a student and lists the roster alphabetically', async () => {
    const klass = await createClass();
    const zoe = await seedUser(ctx.db, { role: 'student', name: 'Zoe' });
    const amy = await seedUser(ctx.db, { role: 'student', name: 'Amy' });

    await call('POST', `/api/v0/classes/${klass.id}/students`, { studentId: zoe.id });
    const response = await call('POST', `/api/v0/classes/${klass.id}/students`, {
      studentId: amy.id,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.map((s: { name: string }) => s.name)).toEqual(['Amy', 'Zoe']);
  });

  it('is idempotent when enrolling twice', async () => {
    const klass = await createClass();
    const student = await seedUser(ctx.db, { role: 'student' });
    const body = { studentId: student.id };

    await call('POST', `/api/v0/classes/${klass.id}/students`, body);
    const second = await call('POST', `/api/v0/classes/${klass.id}/students`, body);

    expect(second.json().data).toHaveLength(1);
  });

  it('unenrols a student', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const klass = await createClass({ studentIds: [student.id] });

    const removed = await call(
      'DELETE',
      `/api/v0/classes/${klass.id}/students/${student.id}`
    );
    expect(removed.statusCode).toBe(204);

    const roster = await call('GET', `/api/v0/classes/${klass.id}/students`);
    expect(roster.json().data).toHaveLength(0);
  });

  it('404s when unenrolling a student who is not enrolled', async () => {
    const klass = await createClass();
    const stranger = await seedUser(ctx.db, { role: 'student' });

    const response = await call(
      'DELETE',
      `/api/v0/classes/${klass.id}/students/${stranger.id}`
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s when enrolling into a missing class', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const response = await call(
      'POST',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000/students',
      { studentId: student.id }
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s when listing the roster of a missing class', async () => {
    const response = await call(
      'GET',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000/students'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /classes/:id', () => {
  it('deletes a class and cascades enrolments and assignments', async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const klass = await createClass({ studentIds: [student.id] });
    await call('POST', `/api/v0/classes/${klass.id}/assignments`, { title: 'Lab' });

    const response = await call('DELETE', `/api/v0/classes/${klass.id}`);
    expect(response.statusCode).toBe(204);

    const [enrolments, assignments] = await Promise.all([
      ctx.db.selectFrom('enrollments').selectAll().where('classId', '=', klass.id).execute(),
      ctx.db.selectFrom('assignments').selectAll().where('classId', '=', klass.id).execute(),
    ]);
    expect(enrolments).toHaveLength(0);
    expect(assignments).toHaveLength(0);
  });

  it('404s for a missing class', async () => {
    const response = await call(
      'DELETE',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('student views', () => {
  it("lists the student's own classes, assignments and grades", async () => {
    const student = await seedUser(ctx.db, { role: 'student' });
    const klass = await createClass({ studentIds: [student.id] });

    const assignment = await call('POST', `/api/v0/classes/${klass.id}/assignments`, {
      title: 'Lab 1',
      published: true,
    });
    const studentCookie = await login(ctx.app, student);

    const submitted = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.json().id}/submissions`,
      headers: { cookie: studentCookie },
      payload: { content: 'my answer' },
    });
    expect(submitted.statusCode).toBe(201);

    const [classes, assignments, submissions] = await Promise.all([
      ctx.app.inject({
        method: 'GET',
        url: `/api/v0/students/${student.id}/classes`,
        headers: { cookie: studentCookie },
      }),
      ctx.app.inject({
        method: 'GET',
        url: `/api/v0/students/${student.id}/assignments`,
        headers: { cookie: studentCookie },
      }),
      ctx.app.inject({
        method: 'GET',
        url: `/api/v0/students/${student.id}/submissions`,
        headers: { cookie: studentCookie },
      }),
    ]);

    expect(classes.json().data).toHaveLength(1);
    expect(assignments.json().data).toHaveLength(1);
    expect(submissions.json().data).toHaveLength(1);
  });

  it('404s for student views of a non-student id', async () => {
    const response = await call('GET', `/api/v0/students/${teacher.id}/assignments`);
    expect(response.statusCode).toBe(409);
  });
});
