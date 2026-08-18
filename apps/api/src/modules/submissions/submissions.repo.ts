import type { DB } from '../../infra/db.ts';
import type { SubmissionRow } from '../../infra/schema.ts';
import type {
  GradeSubmissionInput,
  ListSubmissionsQuery,
} from './submissions.schema.ts';

export interface SubmissionsRepo {
  create(input: {
    assignmentId: string;
    studentId: string;
    content: string;
  }): Promise<SubmissionRow>;
  findById(id: string): Promise<SubmissionRow | undefined>;
  findByAssignmentAndStudent(
    assignmentId: string,
    studentId: string
  ): Promise<SubmissionRow | undefined>;
  listByAssignment(
    assignmentId: string,
    query: ListSubmissionsQuery
  ): Promise<SubmissionRow[]>;
  listByStudent(
    studentId: string,
    query: ListSubmissionsQuery
  ): Promise<SubmissionRow[]>;
  updateContent(
    id: string,
    content: string
  ): Promise<SubmissionRow | undefined>;
  grade(
    id: string,
    input: GradeSubmissionInput
  ): Promise<SubmissionRow | undefined>;
  remove(id: string): Promise<boolean>;
}

export function createSubmissionsRepo(db: DB): SubmissionsRepo {
  return {
    async create(input) {
      return db
        .insertInto('submissions')
        .values(input)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findById(id) {
      return db
        .selectFrom('submissions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async findByAssignmentAndStudent(assignmentId, studentId) {
      return db
        .selectFrom('submissions')
        .selectAll()
        .where('assignmentId', '=', assignmentId)
        .where('studentId', '=', studentId)
        .executeTakeFirst();
    },

    async listByAssignment(assignmentId, query) {
      let q = db
        .selectFrom('submissions')
        .selectAll()
        .where('assignmentId', '=', assignmentId);
      if (query.graded !== undefined)
        q = q.where('grade', query.graded ? 'is not' : 'is', null);
      return q
        .orderBy('submittedAt', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    async listByStudent(studentId, query) {
      let q = db
        .selectFrom('submissions')
        .selectAll()
        .where('studentId', '=', studentId);
      if (query.graded !== undefined)
        q = q.where('grade', query.graded ? 'is not' : 'is', null);
      return q
        .orderBy('submittedAt', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    async updateContent(id, content) {
      return db
        .updateTable('submissions')
        .set({ content, updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async grade(id, input) {
      const now = new Date();
      return db
        .updateTable('submissions')
        .set({
          grade: input.grade,
          feedback: input.feedback ?? null,
          gradedAt: now,
          updatedAt: now,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(id) {
      const result = await db
        .deleteFrom('submissions')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
