import { ForbiddenError } from '../../shared/errors.ts';
import type { PublicUser } from '../../infra/schema.ts';
import type { AssignmentsService } from '../assignments/assignments.service.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { StatsService } from '../stats/stats.service.ts';
import type { SubmissionsService } from '../submissions/submissions.service.ts';
import type { ChatTurn, ClaudeClient, ClaudeReply } from './claude.ts';

export interface ChatService {
  ask(user: PublicUser, messages: ChatTurn[]): Promise<ClaudeReply>;
  buildContext(user: PublicUser): Promise<string>;
}

const LIST_QUERY = { limit: 50, offset: 0 };

/**
 * The chatbot is grounded in app-level context: before each reply the caller's
 * own records are read through the existing services and rendered into the
 * system prompt. Using the services (not raw SQL) means the chatbot inherits
 * exactly the visibility rules the REST API enforces.
 */
export function createChatService(
  claude: ClaudeClient,
  classes: ClassesService,
  assignments: AssignmentsService,
  submissions: SubmissionsService,
  stats: StatsService
): ChatService {
  async function studentContext(user: PublicUser): Promise<string[]> {
    const [enrolled, work, graded] = await Promise.all([
      classes.list({ studentId: user.id, ...LIST_QUERY }),
      assignments.listForStudent(user.id, LIST_QUERY),
      submissions.listByStudent(user.id, LIST_QUERY),
    ]);

    const gradesById = new Map(graded.map((s) => [s.assignmentId, s]));

    return [
      `Enrolled classes: ${enrolled.map((c) => c.name).join(', ') || 'none'}`,
      'Assignments:',
      ...work.map((a) => {
        const submission = gradesById.get(a.id);
        const status = !submission
          ? 'not submitted'
          : submission.grade === null
            ? 'submitted, awaiting grade'
            : `graded ${submission.grade}/${a.maxGrade}${
                submission.feedback ? ` — feedback: "${submission.feedback}"` : ''
              }`;
        const due = a.dueAt ? new Date(a.dueAt).toISOString().slice(0, 10) : 'no due date';
        return `- ${a.title} (due ${due}): ${status}`;
      }),
    ];
  }

  async function teacherContext(user: PublicUser): Promise<string[]> {
    const taught = await classes.list({ teacherId: user.id, ...LIST_QUERY });
    const lines: string[] = [`Classes you teach: ${taught.map((c) => c.name).join(', ') || 'none'}`];

    for (const klass of taught) {
      const [roster, work] = await Promise.all([
        classes.listStudents(klass.id),
        assignments.listByClass(klass.id, LIST_QUERY),
      ]);
      lines.push(
        `- ${klass.name}: ${roster.length} students; assignments: ${
          work.map((a) => `${a.title}${a.published ? '' : ' (draft)'}`).join(', ') || 'none'
        }`
      );
    }

    return lines;
  }

  async function adminContext(): Promise<string[]> {
    const [overview, classList, teachers, students] = await Promise.all([
      stats.averageGrades(),
      stats.classes(),
      stats.teacherNames(),
      stats.studentNames(),
    ]);

    return [
      `School-wide average grade: ${overview.averageGrade ?? 'no grades recorded'} across ${overview.gradedSubmissions} graded submissions`,
      `Teachers (${teachers.length}): ${teachers.map((t) => t.name).join(', ') || 'none'}`,
      `Students (${students.length}): ${students.map((s) => s.name).join(', ') || 'none'}`,
      'Classes:',
      ...classList.map(
        (c) => `- ${c.name} (teacher ${c.teacherName}, ${c.studentCount} students)`
      ),
    ];
  }

  async function buildContext(user: PublicUser): Promise<string> {
    const header = [
      'You are the assistant for a school portal. Answer questions using only the',
      'context below, which is what this user is permitted to see. If the answer is',
      'not in the context, say so plainly rather than guessing, and suggest which',
      'part of the app would show it. Keep replies short and concrete.',
      '',
      `Signed-in user: ${user.name} (${user.email}), role: ${user.role}.`,
      '',
      '--- context ---',
    ];

    const body =
      user.role === 'student'
        ? await studentContext(user)
        : user.role === 'teacher'
          ? await teacherContext(user)
          : await adminContext();

    return [...header, ...body].join('\n');
  }

  return {
    buildContext,

    async ask(user, messages) {
      if (messages.length === 0) {
        throw new ForbiddenError('A conversation needs at least one message');
      }
      return claude.complete(await buildContext(user), messages);
    },
  };
}
