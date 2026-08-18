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

const call = (method: 'POST' | 'GET' | 'PATCH', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: { cookie }, payload });

/**
 * Builds one class with two graded submissions, so the expected averages are
 * computed by hand rather than read back out of the same query under test.
 */
async function seedGradedSchool() {
  const teacher = await seedUser(ctx.db, { role: 'teacher', name: 'Tina Teacher' });
  const sam = await seedUser(ctx.db, { role: 'student', name: 'Sam Student' });
  const sue = await seedUser(ctx.db, { role: 'student', name: 'Sue Student' });

  const klass = (
    await call('POST', '/api/v0/classes', {
      name: 'Physics 101',
      teacherId: teacher.id,
      studentIds: [sam.id, sue.id],
    })
  ).json();

  const assignment = (
    await call('POST', `/api/v0/classes/${klass.id}/assignments`, {
      title: 'Lab 1',
      maxGrade: 50,
      published: true,
    })
  ).json();

  for (const [student, grade] of [
    [sam, 45],
    [sue, 35],
  ] as const) {
    const studentCookie = await login(ctx.app, student);
    const submission = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: studentCookie },
      payload: { content: `answer from ${student.name}` },
    });
    await call('PATCH', `/api/v0/submissions/${submission.json().id}/grade`, { grade });
  }

  return { teacher, sam, sue, klass, assignment };
}

describe('GET /stats/average-grades', () => {
  it('averages every graded submission and breaks it down per class', async () => {
    const { klass } = await seedGradedSchool();

    const response = await call('GET', '/api/v0/stats/average-grades');
    const body = response.json();

    // (45 + 35) / 2
    expect(body.averageGrade).toBe(40);
    expect(body.gradedSubmissions).toBe(2);
    expect(body.perClass).toEqual([
      {
        classId: klass.id,
        className: 'Physics 101',
        averageGrade: 40,
        gradedSubmissions: 2,
      },
    ]);
  });

  it('reports null rather than zero when nothing is graded', async () => {
    const response = await call('GET', '/api/v0/stats/average-grades');
    expect(response.json()).toMatchObject({
      averageGrade: null,
      gradedSubmissions: 0,
    });
  });

  it('ignores ungraded submissions in the average', async () => {
    const { klass, assignment } = await seedGradedSchool();

    // A third student submits but is never graded.
    const extra = await seedUser(ctx.db, { role: 'student' });
    await call('POST', `/api/v0/classes/${klass.id}/students`, { studentId: extra.id });
    const extraCookie = await login(ctx.app, extra);
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: extraCookie },
      payload: { content: 'ungraded' },
    });

    const response = await call('GET', '/api/v0/stats/average-grades');
    expect(response.json()).toMatchObject({ averageGrade: 40, gradedSubmissions: 2 });
  });
});

describe('GET /stats/average-grades/:id', () => {
  it('returns the average for one class', async () => {
    const { klass } = await seedGradedSchool();

    const response = await call('GET', `/api/v0/stats/average-grades/${klass.id}`);
    expect(response.json()).toMatchObject({
      classId: klass.id,
      averageGrade: 40,
      gradedSubmissions: 2,
    });
  });

  it('returns null for a class with no grades', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    const klass = (
      await call('POST', '/api/v0/classes', { name: 'Empty', teacherId: teacher.id })
    ).json();

    const response = await call('GET', `/api/v0/stats/average-grades/${klass.id}`);
    expect(response.json()).toMatchObject({
      averageGrade: null,
      gradedSubmissions: 0,
    });
  });

  it('404s for a missing class', async () => {
    const response = await call(
      'GET',
      '/api/v0/stats/average-grades/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });

  it('rejects a malformed id', async () => {
    const response = await call('GET', '/api/v0/stats/average-grades/not-a-uuid');
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /stats/teacher-names and /stats/student-names', () => {
  it('lists teachers and students separately, alphabetically', async () => {
    await seedGradedSchool();
    await seedUser(ctx.db, { role: 'teacher', name: 'Aaron Teacher' });

    const teachers = await call('GET', '/api/v0/stats/teacher-names');
    const students = await call('GET', '/api/v0/stats/student-names');

    expect(teachers.json().data.map((t: { name: string }) => t.name)).toEqual([
      'Aaron Teacher',
      'Tina Teacher',
    ]);
    expect(students.json().data.map((s: { name: string }) => s.name)).toEqual([
      'Sam Student',
      'Sue Student',
    ]);
  });

  it('returns empty lists on an empty school', async () => {
    const teachers = await call('GET', '/api/v0/stats/teacher-names');
    const students = await call('GET', '/api/v0/stats/student-names');

    expect(teachers.json().data).toEqual([]);
    expect(students.json().data).toEqual([]);
  });

  it('never leaks the password hash', async () => {
    await seedGradedSchool();
    const response = await call('GET', '/api/v0/stats/teacher-names');

    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('scrypt');
  });
});

describe('GET /stats/classes', () => {
  it('summarises classes with teacher name and student count', async () => {
    await seedGradedSchool();

    const response = await call('GET', '/api/v0/stats/classes');
    expect(response.json().data).toEqual([
      expect.objectContaining({
        name: 'Physics 101',
        teacherName: 'Tina Teacher',
        studentCount: 2,
      }),
    ]);
  });

  it('counts a class with no students as zero', async () => {
    const teacher = await seedUser(ctx.db, { role: 'teacher' });
    await call('POST', '/api/v0/classes', { name: 'Empty', teacherId: teacher.id });

    const response = await call('GET', '/api/v0/stats/classes');
    expect(response.json().data[0].studentCount).toBe(0);
  });
});

describe('GET /stats/classes/:id', () => {
  it('lists the students in one class', async () => {
    const { klass } = await seedGradedSchool();

    const response = await call('GET', `/api/v0/stats/classes/${klass.id}`);
    expect(response.json().data.map((s: { name: string }) => s.name)).toEqual([
      'Sam Student',
      'Sue Student',
    ]);
  });

  it('404s for a missing class', async () => {
    const response = await call(
      'GET',
      '/api/v0/stats/classes/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('stats freshness', () => {
  it('reflects a new grade immediately (cache is invalidated on write)', async () => {
    const { klass, assignment } = await seedGradedSchool();

    const before = await call('GET', '/api/v0/stats/average-grades');
    expect(before.json().gradedSubmissions).toBe(2);

    const extra = await seedUser(ctx.db, { role: 'student' });
    await call('POST', `/api/v0/classes/${klass.id}/students`, { studentId: extra.id });
    const extraCookie = await login(ctx.app, extra);
    const submission = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: extraCookie },
      payload: { content: 'third answer' },
    });
    await call('PATCH', `/api/v0/submissions/${submission.json().id}/grade`, { grade: 40 });

    const after = await call('GET', '/api/v0/stats/average-grades');
    expect(after.json().gradedSubmissions).toBe(3);
    expect(after.json().averageGrade).toBe(40); // (45 + 35 + 40) / 3
  });
});
