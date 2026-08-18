import type { DB } from '../../infra/db.ts';
import { PUBLIC_USER_COLUMNS } from '../../infra/schema.ts';
import type { PublicUser } from '../../infra/schema.ts';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from './users.schema.ts';

export interface CreateUserRecord extends CreateUserInput {
  passwordHash?: string | null;
}

/**
 * Reads select `PUBLIC_USER_COLUMNS` rather than `selectAll()` so `password_hash`
 * never leaves this module; the auth module reads it through its own repo.
 */
export interface UsersRepo {
  create(input: CreateUserRecord): Promise<PublicUser>;
  findById(id: string): Promise<PublicUser | undefined>;
  findByEmail(email: string): Promise<PublicUser | undefined>;
  list(query: ListUsersQuery): Promise<PublicUser[]>;
  update(id: string, input: UpdateUserInput): Promise<PublicUser | undefined>;
  setSuspended(id: string, suspended: boolean): Promise<PublicUser | undefined>;
  setPasswordHash(id: string, passwordHash: string): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

export function createUsersRepo(db: DB): UsersRepo {
  return {
    async create(input) {
      return db
        .insertInto('users')
        .values(input)
        .returning(PUBLIC_USER_COLUMNS)
        .executeTakeFirstOrThrow();
    },

    async findById(id) {
      return db
        .selectFrom('users')
        .select(PUBLIC_USER_COLUMNS)
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async findByEmail(email) {
      return db
        .selectFrom('users')
        .select(PUBLIC_USER_COLUMNS)
        .where('email', '=', email)
        .executeTakeFirst();
    },

    async list(query) {
      let q = db.selectFrom('users').select(PUBLIC_USER_COLUMNS);
      if (query.role) q = q.where('role', '=', query.role);
      if (query.suspended !== undefined)
        q = q.where('suspended', '=', query.suspended);
      if (query.search)
        q = q.where((eb) =>
          eb.or([
            eb('name', 'ilike', `%${query.search}%`),
            eb('email', 'ilike', `%${query.search}%`),
          ])
        );
      return q
        .orderBy('createdAt', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    },

    async update(id, input) {
      return db
        .updateTable('users')
        .set({ ...input, updatedAt: new Date() })
        .where('id', '=', id)
        .returning(PUBLIC_USER_COLUMNS)
        .executeTakeFirst();
    },

    async setSuspended(id, suspended) {
      return db
        .updateTable('users')
        .set({ suspended, updatedAt: new Date() })
        .where('id', '=', id)
        .returning(PUBLIC_USER_COLUMNS)
        .executeTakeFirst();
    },

    async setPasswordHash(id, passwordHash) {
      const result = await db
        .updateTable('users')
        .set({ passwordHash, updatedAt: new Date() })
        .where('id', '=', id)
        .executeTakeFirst();
      return Number(result.numUpdatedRows) > 0;
    },

    async remove(id) {
      const result = await db
        .deleteFrom('users')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
