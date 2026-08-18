import type { DB } from '../../infra/db.ts';
import { PUBLIC_USER_COLUMNS_QUALIFIED } from '../../infra/schema.ts';
import type { PublicUser, TeacherGroupRow } from '../../infra/schema.ts';
import type { ListQuery } from '../../shared/validation.ts';
import type { UpdateTeacherGroupInput } from './teacher-groups.schema.ts';

export interface TeacherGroupsRepo {
  create(input: {
    name: string;
    description?: string | null;
  }): Promise<TeacherGroupRow>;
  findById(id: string): Promise<TeacherGroupRow | undefined>;
  list(query: ListQuery): Promise<TeacherGroupRow[]>;
  update(
    id: string,
    input: UpdateTeacherGroupInput
  ): Promise<TeacherGroupRow | undefined>;
  remove(id: string): Promise<boolean>;
  listMembers(groupId: string): Promise<PublicUser[]>;
  addMember(groupId: string, teacherId: string): Promise<void>;
  removeMember(groupId: string, teacherId: string): Promise<boolean>;
}

export function createTeacherGroupsRepo(db: DB): TeacherGroupsRepo {
  return {
    async create(input) {
      return db
        .insertInto('teacherGroups')
        .values({ name: input.name, description: input.description ?? null })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findById(id) {
      return db
        .selectFrom('teacherGroups')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async list(query) {
      return db
        .selectFrom('teacherGroups')
        .selectAll()
        .orderBy('name', 'asc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    async update(id, input) {
      return db
        .updateTable('teacherGroups')
        .set({ ...input, updatedAt: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(id) {
      const result = await db
        .deleteFrom('teacherGroups')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    async listMembers(groupId) {
      return db
        .selectFrom('teacherGroupMembers')
        .innerJoin('users', 'users.id', 'teacherGroupMembers.teacherId')
        .select(PUBLIC_USER_COLUMNS_QUALIFIED)
        .where('teacherGroupMembers.groupId', '=', groupId)
        .orderBy('users.name', 'asc')
        .execute();
    },

    async addMember(groupId, teacherId) {
      await db
        .insertInto('teacherGroupMembers')
        .values({ groupId, teacherId })
        .onConflict((oc) => oc.columns(['groupId', 'teacherId']).doNothing())
        .execute();
    },

    async removeMember(groupId, teacherId) {
      const result = await db
        .deleteFrom('teacherGroupMembers')
        .where('groupId', '=', groupId)
        .where('teacherId', '=', teacherId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
