import { describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '../../infra/schema.ts';
import { ForbiddenError } from '../../shared/errors.ts';
import { createChatService } from './chat.service.ts';
import type { ClaudeClient } from './claude.ts';

/**
 * The integration suite covers the chat route end to end; these tests drive the
 * context builder through the record shapes a real school produces — ungraded
 * work, missing due dates, feedback — which are awkward to stage over HTTP.
 */
function user(role: PublicUser['role'], overrides: Partial<PublicUser> = {}) {
  return {
    id: `${role}-1`,
    email: `${role}@school.test`,
    name: `${role} user`,
    role,
    suspended: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PublicUser;
}

const claude: ClaudeClient = {
  complete: vi.fn(async () => ({
    text: 'ok',
    stopReason: 'end_turn',
    usage: { inputTokens: 1, outputTokens: 1 },
  })),
};

/** Only the methods the chat service actually reaches need to exist. */
function services(overrides: Record<string, unknown> = {}) {
  const base = {
    classes: { list: async () => [], listStudents: async () => [] },
    assignments: {
      listForStudent: async () => [],
      listByClass: async () => [],
    },
    submissions: { listByStudent: async () => [] },
    stats: {
      averageGrades: async () => ({ averageGrade: null, gradedSubmissions: 0 }),
      classes: async () => [],
      teacherNames: async () => [],
      studentNames: async () => [],
    },
  };
  const merged = { ...base, ...overrides };
  return [
    merged.classes,
    merged.assignments,
    merged.submissions,
    merged.stats,
  ] as unknown as [never, never, never, never];
}

function build(overrides: Record<string, unknown> = {}) {
  return createChatService(claude, ...services(overrides));
}

describe('student context', () => {
  const assignment = {
    id: 'a-1',
    title: 'Essay',
    maxGrade: 100,
    dueAt: new Date('2026-03-01T00:00:00Z'),
  };

  it('reports an assignment with no submission as not submitted', async () => {
    const context = await build({
      assignments: { listForStudent: async () => [assignment] },
    }).buildContext(user('student'));

    expect(context).toContain('- Essay (due 2026-03-01): not submitted');
  });

  it('reports a submitted but ungraded assignment as awaiting a grade', async () => {
    const context = await build({
      assignments: { listForStudent: async () => [assignment] },
      submissions: {
        listByStudent: async () => [
          { assignmentId: 'a-1', grade: null, feedback: null },
        ],
      },
    }).buildContext(user('student'));

    expect(context).toContain('submitted, awaiting grade');
  });

  it('reports a grade without feedback', async () => {
    const context = await build({
      assignments: { listForStudent: async () => [assignment] },
      submissions: {
        listByStudent: async () => [
          { assignmentId: 'a-1', grade: 88, feedback: null },
        ],
      },
    }).buildContext(user('student'));

    expect(context).toContain('graded 88/100');
    expect(context).not.toContain('feedback');
  });

  it('includes the feedback when the teacher left some', async () => {
    const context = await build({
      assignments: { listForStudent: async () => [assignment] },
      submissions: {
        listByStudent: async () => [
          { assignmentId: 'a-1', grade: 88, feedback: 'Tighten the intro' },
        ],
      },
    }).buildContext(user('student'));

    expect(context).toContain('graded 88/100 — feedback: "Tighten the intro"');
  });

  it('says so when an assignment has no due date', async () => {
    const context = await build({
      assignments: {
        listForStudent: async () => [{ ...assignment, dueAt: null }],
      },
    }).buildContext(user('student'));

    expect(context).toContain('- Essay (due no due date): not submitted');
  });

  it('says none when the student is enrolled nowhere', async () => {
    const context = await build().buildContext(user('student'));

    expect(context).toContain('Enrolled classes: none');
  });

  it('lists the enrolled class names', async () => {
    const context = await build({
      classes: { list: async () => [{ name: 'Physics' }, { name: 'Latin' }] },
    }).buildContext(user('student'));

    expect(context).toContain('Enrolled classes: Physics, Latin');
  });
});

describe('teacher context', () => {
  it('says none when the teacher has no classes', async () => {
    const context = await build().buildContext(user('teacher'));

    expect(context).toContain('Classes you teach: none');
  });

  it('summarises each class roster and marks drafts', async () => {
    const context = await build({
      classes: {
        list: async () => [{ id: 'c-1', name: 'Physics' }],
        listStudents: async () => [{ id: 's-1' }, { id: 's-2' }],
      },
      assignments: {
        listByClass: async () => [
          { title: 'Lab 1', published: true },
          { title: 'Lab 2', published: false },
        ],
      },
    }).buildContext(user('teacher'));

    expect(context).toContain(
      '- Physics: 2 students; assignments: Lab 1, Lab 2 (draft)'
    );
  });

  it('says none when a class has no assignments yet', async () => {
    const context = await build({
      classes: {
        list: async () => [{ id: 'c-1', name: 'Physics' }],
        listStudents: async () => [],
      },
    }).buildContext(user('teacher'));

    expect(context).toContain('- Physics: 0 students; assignments: none');
  });
});

describe('admin context', () => {
  it('reports empty rosters and an absent average', async () => {
    const context = await build().buildContext(user('admin'));

    expect(context).toContain('School-wide average grade: no grades recorded');
    expect(context).toContain('Teachers (0): none');
    expect(context).toContain('Students (0): none');
  });

  it('reports the school-wide figures when there are records', async () => {
    const context = await build({
      stats: {
        averageGrades: async () => ({
          averageGrade: 79.5,
          gradedSubmissions: 12,
        }),
        classes: async () => [
          { name: 'Physics', teacherName: 'Tina', studentCount: 3 },
        ],
        teacherNames: async () => [{ name: 'Tina' }],
        studentNames: async () => [{ name: 'Sam' }, { name: 'Sue' }],
      },
    }).buildContext(user('admin'));

    expect(context).toContain(
      'School-wide average grade: 79.5 across 12 graded submissions'
    );
    expect(context).toContain('Teachers (1): Tina');
    expect(context).toContain('Students (2): Sam, Sue');
    expect(context).toContain('- Physics (teacher Tina, 3 students)');
  });
});

describe('ask', () => {
  it('sends the built context as the system prompt', async () => {
    const complete = vi.fn(async () => ({
      text: 'reply',
      stopReason: 'end_turn',
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    const service = createChatService({ complete }, ...services());
    const messages = [{ role: 'user' as const, content: 'What is due?' }];

    await expect(service.ask(user('student'), messages)).resolves.toMatchObject(
      {
        text: 'reply',
      }
    );
    expect(complete).toHaveBeenCalledWith(
      expect.stringContaining('Signed-in user: student user'),
      messages
    );
  });

  it('refuses an empty conversation', async () => {
    await expect(build().ask(user('student'), [])).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });
});
