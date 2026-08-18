import type { DB } from '../../infra/db.ts';
import type { AssignmentRow } from '../../infra/schema.ts';
import type {
  CreateAssignmentInput,
  ListAssignmentsQuery,
  UpdateAssignmentInput,
} from './assignments.schema.ts';

export interface AssignmentsRepo {
  create(classId: string, input: CreateAssignmentInput): Promise<AssignmentRow>;
  findById(id: string): Promise<AssignmentRow | undefined>;
  listByClass(
    classId: string,
    query: ListAssignmentsQuery
  ): Promise<AssignmentRow[]>;
  listForStudent(
    studentId: string,
    query: ListAssignmentsQuery
  ): Promise<AssignmentRow[]>;
  update(
    id: string,
    input: UpdateAssignmentInput
  ): Promise<AssignmentRow | undefined>;
  setPublished(
    id: string,
    published: boolean
  ): Promise<AssignmentRow | undefined>;
  remove(id: string): Promise<boolean>;
}

export function createAssignmentsRepo(db: DB): AssignmentsRepo {
  return {
    async create(classId, input) {
      return db
        .insertInto('assignments')
        .values({
          classId,
          title: input.title,
          description: input.description ?? null,
          dueAt: input.dueAt ?? null,
          maxGrade: input.maxGrade,
          published: input.published,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findById(id) {
      return db
        .selectFrom('assignments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async listByClass(classId, query) {
      let q = db
        .selectFrom('assignments')
        .selectAll()
        .where('classId', '=', classId);
      if (query.published !== undefined)
        q = q.where('published', '=', query.published);
      return q
        .orderBy('createdAt', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    /** Assignments across every class the student is enrolled in. */
    async listForStudent(studentId, query) {
      let q = db
        .selectFrom('assignments')
        .innerJoin('enrollments', 'enrollments.classId', 'assignments.classId')
        .selectAll('assignments')
        .where('enrollments.studentId', '=', studentId);
      if (query.published !== undefined)
        q = q.where('assignments.published', '=', query.published);
      return q
        .orderBy('assignments.dueAt', 'asc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    async update(id, input) {
      return db
        .updateTable('assignments')
        .set({ ...input, updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async setPublished(id, published) {
      return db
        .updateTable('assignments')
        .set({ published, updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(id) {
      const result = await db
        .deleteFrom('assignments')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
