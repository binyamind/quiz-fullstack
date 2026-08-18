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
let teacher: { user: SeededUser; cookie: string };
let student: SeededUser;
let studentCookie: string;
let classId: string;
let publishedId: string;
let draftId: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

/** A class with one published and one draft assignment, and one enrolled student. */
beforeEach(async () => {
  await truncateAll(ctx.pool);
  teacher = await asUser(ctx.app, ctx.db, 'teacher');
  student = await seedUser(ctx.db, { role: 'student' });
  studentCookie = await login(ctx.app, student);

  const klass = await ctx.app.inject({
    method: 'POST',
    url: '/api/v0/classes',
    headers: { cookie: teacher.cookie },
    payload: { name: 'Physics', teacherId: teacher.user.id },
  });
  classId = klass.json().id;

  await ctx.app.inject({
    method: 'POST',
    url: `/api/v0/classes/${classId}/students`,
    headers: { cookie: teacher.cookie },
    payload: { studentId: student.id },
  });

  const published = await ctx.app.inject({
    method: 'POST',
    url: `/api/v0/classes/${classId}/assignments`,
    headers: { cookie: teacher.cookie },
    payload: { title: 'Lab 1', description: 'Measure g', maxGrade: 100 },
  });
  publishedId = published.json().id;
  await ctx.app.inject({
    method: 'POST',
    url: `/api/v0/assignments/${publishedId}/publish`,
    headers: { cookie: teacher.cookie },
  });

  const draft = await ctx.app.inject({
    method: 'POST',
    url: `/api/v0/classes/${classId}/assignments`,
    headers: { cookie: teacher.cookie },
    payload: { title: 'Lab 2', description: 'Draft', maxGrade: 50 },
  });
  draftId = draft.json().id;
});

async function submit(assignmentId: string, content = 'my answer') {
  const response = await ctx.app.inject({
    method: 'POST',
    url: `/api/v0/assignments/${assignmentId}/submissions`,
    headers: { cookie: studentCookie },
    payload: { content },
  });
  return response.json();
}

describe('GET /students/:id/classes', () => {
  it('lists the classes the student is enrolled in', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/classes`,
      headers: { cookie: studentCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((c: { name: string }) => c.name)).toEqual([
      'Physics',
    ]);
  });

  it('honours limit and offset', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/classes?limit=1&offset=1`,
      headers: { cookie: studentCookie },
    });

    expect(response.json().data).toEqual([]);
  });
});

describe('GET /students/:id/assignments', () => {
  it('lists every assignment in the enrolled classes', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/assignments`,
      headers: { cookie: studentCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(2);
  });

  it('filters to the published ones', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/assignments?published=true`,
      headers: { cookie: studentCookie },
    });

    expect(response.json().data.map((a: { id: string }) => a.id)).toEqual([
      publishedId,
    ]);
  });

  it('filters to the drafts', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/assignments?published=false`,
      headers: { cookie: studentCookie },
    });

    expect(response.json().data.map((a: { id: string }) => a.id)).toEqual([
      draftId,
    ]);
  });
});

describe('GET /students/:id/submissions', () => {
  it('lists the submissions the student has made', async () => {
    await submit(publishedId);

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/submissions`,
      headers: { cookie: studentCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('filters to the graded submissions', async () => {
    const submission = await submit(publishedId);
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/submissions/${submission.id}/grade`,
      headers: { cookie: teacher.cookie },
      payload: { grade: 91, feedback: 'Solid work' },
    });

    const graded = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/submissions?graded=true`,
      headers: { cookie: studentCookie },
    });
    const ungraded = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/submissions?graded=false`,
      headers: { cookie: studentCookie },
    });

    expect(graded.json().data).toHaveLength(1);
    expect(ungraded.json().data).toEqual([]);
  });
});

describe('access control', () => {
  it("refuses a student reading another student's records", async () => {
    const other = await seedUser(ctx.db, { role: 'student' });
    const otherCookie = await login(ctx.app, other);

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/classes`,
      headers: { cookie: otherCookie },
    });

    expect(response.statusCode).toBe(403);
  });

  it('lets a teacher read a student view', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/assignments`,
      headers: { cookie: teacher.cookie },
    });

    expect(response.statusCode).toBe(200);
  });

  it('lets an admin read a student view', async () => {
    const admin = await asUser(ctx.app, ctx.db, 'admin');

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/submissions`,
      headers: { cookie: admin.cookie },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/students/${student.id}/classes`,
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('submission visibility', () => {
  it("refuses a student reading another student's submission", async () => {
    const submission = await submit(publishedId);
    const other = await seedUser(ctx.db, { role: 'student' });
    const otherCookie = await login(ctx.app, other);

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/submissions/${submission.id}`,
      headers: { cookie: otherCookie },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe(
      'You may only read your own submissions'
    );
  });

  it("refuses a student editing another student's submission", async () => {
    const submission = await submit(publishedId);
    const other = await seedUser(ctx.db, { role: 'student' });
    const otherCookie = await login(ctx.app, other);

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/submissions/${submission.id}`,
      headers: { cookie: otherCookie },
      payload: { content: 'not mine to edit' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe(
      'You may only edit your own submissions'
    );
  });

  it('lets the owning student read and edit their own submission', async () => {
    const submission = await submit(publishedId);

    const read = await ctx.app.inject({
      method: 'GET',
      url: `/api/v0/submissions/${submission.id}`,
      headers: { cookie: studentCookie },
    });
    const edited = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v0/submissions/${submission.id}`,
      headers: { cookie: studentCookie },
      payload: { content: 'revised answer' },
    });

    expect(read.statusCode).toBe(200);
    expect(edited.statusCode).toBe(200);
    expect(edited.json().content).toBe('revised answer');
  });
});
