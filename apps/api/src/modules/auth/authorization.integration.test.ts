import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asUser,
  createTestContext,
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

async function makeClass(cookie: string, teacherId: string, name = 'Physics') {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/v0/classes',
    headers: { cookie },
    payload: { name, teacherId },
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

describe('unauthenticated access', () => {
  const protectedRoutes = [
    ['GET', '/api/v0/users'],
    ['GET', '/api/v0/teacher-groups'],
    ['GET', '/api/v0/classes'],
    ['GET', '/api/v0/stats/average-grades'],
    ['GET', '/api/v0/stats/teacher-names'],
  ] as const;

  it.each(protectedRoutes)('rejects %s %s with 401', async (method, url) => {
    const response = await ctx.app.inject({ method, url });
    expect(response.statusCode).toBe(401);
  });

  it('leaves /health open for container probes', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });
});

describe('admin-only routes', () => {
  it('lets an admin manage users', async () => {
    const { cookie } = await asUser(ctx.app, ctx.db, 'admin');

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/users',
      headers: { cookie },
      payload: {
        email: 'new-teacher@test.local',
        name: 'New Teacher',
        role: 'teacher',
        password: 'password-1234',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).not.toHaveProperty('passwordHash');
  });

  it('forbids a teacher from listing users', async () => {
    const { cookie } = await asUser(ctx.app, ctx.db, 'teacher');
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/v0/users',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
  });

  it('forbids a student from suspending anyone', async () => {
    const { cookie } = await asUser(ctx.app, ctx.db, 'student');
    const victim = await asUser(ctx.app, ctx.db, 'teacher');

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/users/${victim.user.id}/suspend`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
  });

  it('forbids a teacher from touching teacher groups', async () => {
    const { cookie } = await asUser(ctx.app, ctx.db, 'teacher');
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/teacher-groups',
      headers: { cookie },
      payload: { name: 'Self-Promotion Dept' },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('class ownership', () => {
  it('lets the owning teacher edit their class', async () => {
    const teacher = await asUser(ctx.app, ctx.db, 'teacher');
    const klass = await makeClass(teacher.cookie, teacher.user.id);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/classes/${klass.id}`,
      headers: { cookie: teacher.cookie },
      payload: { name: 'Physics 201' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Physics 201');
  });

  it('forbids another teacher from editing that class', async () => {
    const owner = await asUser(ctx.app, ctx.db, 'teacher');
    const intruder = await asUser(ctx.app, ctx.db, 'teacher');
    const klass = await makeClass(owner.cookie, owner.user.id);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/classes/${klass.id}`,
      headers: { cookie: intruder.cookie },
      payload: { name: 'Hijacked' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toMatch(/do not teach/i);
  });

  it('forbids another teacher from enrolling students into it', async () => {
    const owner = await asUser(ctx.app, ctx.db, 'teacher');
    const intruder = await asUser(ctx.app, ctx.db, 'teacher');
    const student = await asUser(ctx.app, ctx.db, 'student');
    const klass = await makeClass(owner.cookie, owner.user.id);

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/classes/${klass.id}/students`,
      headers: { cookie: intruder.cookie },
      payload: { studentId: student.user.id },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lets an admin override ownership', async () => {
    const teacher = await asUser(ctx.app, ctx.db, 'teacher');
    const admin = await asUser(ctx.app, ctx.db, 'admin');
    const klass = await makeClass(teacher.cookie, teacher.user.id);

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v0/classes/${klass.id}`,
      headers: { cookie: admin.cookie },
    });

    expect(response.statusCode).toBe(204);
  });

  it('forbids a student from creating a class', async () => {
    const student = await asUser(ctx.app, ctx.db, 'student');
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v0/classes',
      headers: { cookie: student.cookie },
      payload: { name: 'Easy A', teacherId: student.user.id },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('student self-access', () => {
  it('lets a student read their own records', async () => {
    const student = await asUser(ctx.app, ctx.db, 'student');

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.user.id}/classes`,
      headers: { cookie: student.cookie },
    });

    expect(response.statusCode).toBe(200);
  });

  it("forbids a student from reading another student's grades", async () => {
    const student = await asUser(ctx.app, ctx.db, 'student');
    const classmate = await asUser(ctx.app, ctx.db, 'student');

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${classmate.user.id}/submissions`,
      headers: { cookie: student.cookie },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lets staff read any student record', async () => {
    const teacher = await asUser(ctx.app, ctx.db, 'teacher');
    const student = await asUser(ctx.app, ctx.db, 'student');

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.user.id}/assignments`,
      headers: { cookie: teacher.cookie },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('submissions and grading', () => {
  async function setupPublishedAssignment() {
    const teacher = await asUser(ctx.app, ctx.db, 'teacher');
    const student = await asUser(ctx.app, ctx.db, 'student');
    const klass = await makeClass(teacher.cookie, teacher.user.id);

    await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/classes/${klass.id}/students`,
      headers: { cookie: teacher.cookie },
      payload: { studentId: student.user.id },
    });

    const assignment = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/classes/${klass.id}/assignments`,
      headers: { cookie: teacher.cookie },
      payload: { title: 'Lab 1', maxGrade: 50, published: true },
    });

    return { teacher, student, klass, assignment: assignment.json() };
  }

  it('takes the submitting student from the session, not the body', async () => {
    const { student, classmate, assignment } = {
      ...(await setupPublishedAssignment()),
      classmate: await asUser(ctx.app, ctx.db, 'student'),
    };

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: student.cookie },
      // Claiming to be someone else must not work.
      payload: { studentId: classmate.user.id, content: 'my answer' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('records a student submission under their own id', async () => {
    const { student, assignment } = await setupPublishedAssignment();

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: student.cookie },
      payload: { content: 'F = ma' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().studentId).toBe(student.user.id);
  });

  it('forbids a student from grading', async () => {
    const { student, assignment } = await setupPublishedAssignment();
    const submission = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: student.cookie },
      payload: { content: 'F = ma' },
    });

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/submissions/${submission.json().id}/grade`,
      headers: { cookie: student.cookie },
      payload: { grade: 50, feedback: 'A+ for me' },
    });

    expect(response.statusCode).toBe(403);
  });

  it("forbids a student from reading a classmate's submission", async () => {
    const { student, assignment } = await setupPublishedAssignment();
    const classmate = await asUser(ctx.app, ctx.db, 'student');
    const submission = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: student.cookie },
      payload: { content: 'F = ma' },
    });

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/submissions/${submission.json().id}`,
      headers: { cookie: classmate.cookie },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lets the teacher grade and the student then see the feedback', async () => {
    const { teacher, student, assignment } = await setupPublishedAssignment();
    const submission = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: student.cookie },
      payload: { content: 'F = ma' },
    });

    const graded = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/submissions/${submission.json().id}/grade`,
      headers: { cookie: teacher.cookie },
      payload: { grade: 45, feedback: 'Solid' },
    });
    expect(graded.statusCode).toBe(200);

    const mine = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.user.id}/submissions`,
      headers: { cookie: student.cookie },
    });

    expect(mine.json().data[0]).toMatchObject({ grade: 45, feedback: 'Solid' });
  });

  it('forbids a student from seeing the whole class list of submissions', async () => {
    const { student, assignment } = await setupPublishedAssignment();
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: student.cookie },
    });
    expect(response.statusCode).toBe(403);
  });
});
