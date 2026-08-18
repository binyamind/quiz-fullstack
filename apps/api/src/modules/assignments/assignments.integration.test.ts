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
let student: SeededUser;
let studentCookie: string;
let classId: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await truncateAll(ctx.pool);
  cookie = (await asUser(ctx.app, ctx.db, 'admin')).cookie;

  teacher = await seedUser(ctx.db, { role: 'teacher' });
  student = await seedUser(ctx.db, { role: 'student' });
  studentCookie = await login(ctx.app, student);

  const klass = await ctx.app.inject({
    method: 'POST',
    url: '/api/v0/classes',
    headers: { cookie },
    payload: { name: 'Physics', teacherId: teacher.id, studentIds: [student.id] },
  });
  classId = klass.json().id;
});

const call = (method: 'POST' | 'GET' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: { cookie }, payload });

const asStudent = (method: 'POST' | 'GET' | 'PATCH', url: string, payload?: unknown) =>
  ctx.app.inject({ method, url, headers: { cookie: studentCookie }, payload });

const createAssignment = async (payload: Record<string, unknown> = {}) => {
  const response = await call('POST', `/api/v0/classes/${classId}/assignments`, {
    title: 'Newton lab',
    published: true,
    ...payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json();
};

const submit = async (content = 'F = ma') => {
  const assignment = await createAssignment();
  const response = await asStudent(
    'POST',
    `/api/v0/assignments/${assignment.id}/submissions`,
    { content }
  );
  expect(response.statusCode).toBe(201);
  return { assignment, submission: response.json() };
};

describe('assignment creation', () => {
  it('defaults to unpublished with a max grade of 100', async () => {
    const assignment = await createAssignment({ published: undefined });
    expect(assignment).toMatchObject({ published: false, maxGrade: 100 });
  });

  it('stores an explicit due date and max grade', async () => {
    const assignment = await createAssignment({
      dueAt: '2026-09-01T00:00:00.000Z',
      maxGrade: 50,
    });

    expect(assignment.maxGrade).toBe(50);
    expect(new Date(assignment.dueAt).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('404s for a missing class', async () => {
    const response = await call(
      'POST',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000/assignments',
      { title: 'Ghost' }
    );
    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['empty title', { title: '' }],
    ['negative max grade', { title: 'X', maxGrade: -5 }],
    ['non-numeric max grade', { title: 'X', maxGrade: 'lots' }],
    ['invalid date', { title: 'X', dueAt: 'not-a-date' }],
  ])('rejects %s', async (_label, payload) => {
    const response = await call('POST', `/api/v0/classes/${classId}/assignments`, payload);
    expect(response.statusCode).toBe(400);
  });
});

describe('assignment listing', () => {
  it('lists a class\'s assignments and filters by published state', async () => {
    await createAssignment({ title: 'Published', published: true });
    await createAssignment({ title: 'Draft', published: false });

    const all = await call('GET', `/api/v0/classes/${classId}/assignments`);
    const published = await call(
      'GET',
      `/api/v0/classes/${classId}/assignments?published=true`
    );

    expect(all.json().data).toHaveLength(2);
    expect(published.json().data.map((a: { title: string }) => a.title)).toEqual([
      'Published',
    ]);
  });

  it('404s listing assignments for a missing class', async () => {
    const response = await call(
      'GET',
      '/api/v0/classes/00000000-0000-0000-0000-000000000000/assignments'
    );
    expect(response.statusCode).toBe(404);
  });

  it('fetches one assignment and 404s for a missing id', async () => {
    const assignment = await createAssignment();

    const found = await call('GET', `/api/v0/assignments/${assignment.id}`);
    const missing = await call(
      'GET',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000'
    );

    expect(found.json().id).toBe(assignment.id);
    expect(missing.statusCode).toBe(404);
  });
});

describe('publish lifecycle', () => {
  it('publishes and unpublishes', async () => {
    const assignment = await createAssignment({ published: false });

    const published = await call('POST', `/api/v0/assignments/${assignment.id}/publish`);
    expect(published.json().published).toBe(true);

    const unpublished = await call(
      'POST',
      `/api/v0/assignments/${assignment.id}/unpublish`
    );
    expect(unpublished.json().published).toBe(false);
  });

  it('404s publishing a missing assignment', async () => {
    const response = await call(
      'POST',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000/publish'
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s unpublishing a missing assignment', async () => {
    const response = await call(
      'POST',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000/unpublish'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('assignment update and delete', () => {
  it('updates fields', async () => {
    const assignment = await createAssignment();
    const response = await call('PATCH', `/api/v0/assignments/${assignment.id}`, {
      title: 'Renamed',
      maxGrade: 75,
    });

    expect(response.json()).toMatchObject({ title: 'Renamed', maxGrade: 75 });
  });

  it('clears the due date with null', async () => {
    const assignment = await createAssignment({ dueAt: '2026-09-01T00:00:00.000Z' });
    const response = await call('PATCH', `/api/v0/assignments/${assignment.id}`, {
      dueAt: null,
    });

    expect(response.json().dueAt).toBeNull();
  });

  it('rejects an empty patch and 404s for a missing assignment', async () => {
    const assignment = await createAssignment();

    const empty = await call('PATCH', `/api/v0/assignments/${assignment.id}`, {});
    const missing = await call(
      'PATCH',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000',
      { title: 'Ghost' }
    );

    expect(empty.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
  });

  it('deletes an assignment and cascades its submissions', async () => {
    const { assignment } = await submit();

    const response = await call('DELETE', `/api/v0/assignments/${assignment.id}`);
    expect(response.statusCode).toBe(204);

    const submissions = await ctx.db
      .selectFrom('submissions')
      .selectAll()
      .where('assignmentId', '=', assignment.id)
      .execute();
    expect(submissions).toHaveLength(0);
  });

  it('404s deleting a missing assignment', async () => {
    const response = await call(
      'DELETE',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('submissions', () => {
  it('records a submission against the signed-in student', async () => {
    const { submission } = await submit('F = ma');
    expect(submission).toMatchObject({
      studentId: student.id,
      content: 'F = ma',
      grade: null,
      feedback: null,
    });
  });

  it('refuses a submission to an unpublished assignment', async () => {
    const assignment = await createAssignment({ published: false });
    const response = await asStudent(
      'POST',
      `/api/v0/assignments/${assignment.id}/submissions`,
      { content: 'early' }
    );

    expect(response.statusCode).toBe(409);
  });

  it('refuses a second submission from the same student', async () => {
    const { assignment } = await submit();
    const response = await asStudent(
      'POST',
      `/api/v0/assignments/${assignment.id}/submissions`,
      { content: 'again' }
    );

    expect(response.statusCode).toBe(409);
  });

  it('refuses a submission from a student not enrolled in the class', async () => {
    const outsider = await seedUser(ctx.db, { role: 'student' });
    const outsiderCookie = await login(ctx.app, outsider);
    const assignment = await createAssignment();

    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v0/assignments/${assignment.id}/submissions`,
      headers: { cookie: outsiderCookie },
      payload: { content: 'let me in' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('requires staff to name the student they submit for', async () => {
    const assignment = await createAssignment();

    const missingId = await call(
      'POST',
      `/api/v0/assignments/${assignment.id}/submissions`,
      { content: 'on behalf' }
    );
    const withId = await call(
      'POST',
      `/api/v0/assignments/${assignment.id}/submissions`,
      { content: 'on behalf', studentId: student.id }
    );

    expect(missingId.statusCode).toBe(400);
    expect(withId.statusCode).toBe(201);
  });

  it('404s submitting to a missing assignment', async () => {
    const response = await asStudent(
      'POST',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000/submissions',
      { content: 'ghost' }
    );
    expect(response.statusCode).toBe(404);
  });

  it('rejects empty content', async () => {
    const assignment = await createAssignment();
    const response = await asStudent(
      'POST',
      `/api/v0/assignments/${assignment.id}/submissions`,
      { content: '' }
    );
    expect(response.statusCode).toBe(400);
  });

  it('lets a student edit an ungraded submission', async () => {
    const { submission } = await submit();
    const response = await asStudent('PATCH', `/api/v0/submissions/${submission.id}`, {
      content: 'revised answer',
    });

    expect(response.json().content).toBe('revised answer');
  });

  it('lists submissions for an assignment and filters by graded state', async () => {
    const { assignment, submission } = await submit();

    const ungraded = await call(
      'GET',
      `/api/v0/assignments/${assignment.id}/submissions?graded=false`
    );
    expect(ungraded.json().data).toHaveLength(1);

    await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, { grade: 90 });

    const graded = await call(
      'GET',
      `/api/v0/assignments/${assignment.id}/submissions?graded=true`
    );
    expect(graded.json().data).toHaveLength(1);
  });

  it('404s listing submissions for a missing assignment', async () => {
    const response = await call(
      'GET',
      '/api/v0/assignments/00000000-0000-0000-0000-000000000000/submissions'
    );
    expect(response.statusCode).toBe(404);
  });

  it('404s fetching a missing submission', async () => {
    const response = await call(
      'GET',
      '/api/v0/submissions/00000000-0000-0000-0000-000000000000'
    );
    expect(response.statusCode).toBe(404);
  });

  it('deletes a submission', async () => {
    const { submission } = await submit();

    const deleted = await call('DELETE', `/api/v0/submissions/${submission.id}`);
    expect(deleted.statusCode).toBe(204);

    const missing = await call('DELETE', `/api/v0/submissions/${submission.id}`);
    expect(missing.statusCode).toBe(404);
  });
});

describe('grading', () => {
  it('records grade, feedback and a graded timestamp', async () => {
    const { submission } = await submit();

    const response = await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, {
      grade: 88,
      feedback: 'Solid work',
    });

    expect(response.json()).toMatchObject({ grade: 88, feedback: 'Solid work' });
    expect(response.json().gradedAt).not.toBeNull();
  });

  it('allows grading without feedback', async () => {
    const { submission } = await submit();
    const response = await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, {
      grade: 70,
    });

    expect(response.json().feedback).toBeNull();
  });

  it('rejects a grade above the assignment maximum', async () => {
    const assignment = await createAssignment({ maxGrade: 50 });
    const submitted = await asStudent(
      'POST',
      `/api/v0/assignments/${assignment.id}/submissions`,
      { content: 'answer' }
    );

    const response = await call(
      'PATCH',
      `/api/v0/submissions/${submitted.json().id}/grade`,
      { grade: 80 }
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/maximum/i);
  });

  it('rejects a negative grade', async () => {
    const { submission } = await submit();
    const response = await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, {
      grade: -1,
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses to edit a graded submission', async () => {
    const { submission } = await submit();
    await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, { grade: 60 });

    const response = await asStudent('PATCH', `/api/v0/submissions/${submission.id}`, {
      content: 'sneaky edit',
    });

    expect(response.statusCode).toBe(409);
  });

  it('allows re-grading', async () => {
    const { submission } = await submit();
    await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, { grade: 60 });

    const response = await call('PATCH', `/api/v0/submissions/${submission.id}/grade`, {
      grade: 95,
      feedback: 'Re-marked after review',
    });

    expect(response.json().grade).toBe(95);
  });

  it('404s grading a missing submission', async () => {
    const response = await call(
      'PATCH',
      '/api/v0/submissions/00000000-0000-0000-0000-000000000000/grade',
      { grade: 50 }
    );
    expect(response.statusCode).toBe(404);
  });
});
