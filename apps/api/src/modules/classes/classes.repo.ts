import type { DB } from '../../infra/db.ts';
import { PUBLIC_USER_COLUMNS_QUALIFIED } from '../../infra/schema.ts';
import type { ClassRow, PublicUser } from '../../infra/schema.ts';
import type { ListClassesQuery, UpdateClassInput } from './classes.schema.ts';

export interface ClassesRepo {
  create(input: {
    name: string;
    description?: string | null;
    teacherId: string;
  }): Promise<ClassRow>;
  findById(id: string): Promise<ClassRow | undefined>;
  list(query: ListClassesQuery): Promise<ClassRow[]>;
  update(id: string, input: UpdateClassInput): Promise<ClassRow | undefined>;
  remove(id: string): Promise<boolean>;
  listStudents(classId: string): Promise<PublicUser[]>;
  enroll(classId: string, studentId: string): Promise<void>;
  unenroll(classId: string, studentId: string): Promise<boolean>;
  isEnrolled(classId: string, studentId: string): Promise<boolean>;
}

export function createClassesRepo(db: DB): ClassesRepo {
  return {
    async create(input) {
      return db
        .insertInto('classes')
        .values({
          name: input.name,
          description: input.description ?? null,
          teacherId: input.teacherId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findById(id) {
      return db
        .selectFrom('classes')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async list(query) {
      let q = db.selectFrom('classes').selectAll('classes');
      if (query.teacherId)
        q = q.where('classes.teacherId', '=', query.teacherId);
      if (query.studentId) {
        q = q
          .innerJoin('enrollments', 'enrollments.classId', 'classes.id')
          .where('enrollments.studentId', '=', query.studentId);
      }
      return q
        .orderBy('classes.name', 'asc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    async update(id, input) {
      return db
        .updateTable('classes')
        .set({ ...input, updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(id) {
      const result = await db
        .deleteFrom('classes')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    async listStudents(classId) {
      return db
        .selectFrom('enrollments')
        .innerJoin('users', 'users.id', 'enrollments.studentId')
        .select(PUBLIC_USER_COLUMNS_QUALIFIED)
        .where('enrollments.classId', '=', classId)
        .orderBy('users.name', 'asc')
        .execute();
    },

    async enroll(classId, studentId) {
      await db
        .insertInto('enrollments')
        .values({ classId, studentId })
        .onConflict((oc) => oc.columns(['classId', 'studentId']).doNothing())
        .execute();
    },

    async unenroll(classId, studentId) {
      const result = await db
        .deleteFrom('enrollments')
        .where('classId', '=', classId)
        .where('studentId', '=', studentId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    async isEnrolled(classId, studentId) {
      const row = await db
        .selectFrom('enrollments')
        .select('studentId')
        .where('classId', '=', classId)
        .where('studentId', '=', studentId)
        .executeTakeFirst();
      return row !== undefined;
    },
  };
}
