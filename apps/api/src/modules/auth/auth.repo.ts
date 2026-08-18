import type { DB } from '../../infra/db.ts';
import { PUBLIC_USER_COLUMNS } from '../../infra/schema.ts';
import type { PublicUser, Role, UserRow } from '../../infra/schema.ts';

export interface AuthRepo {
  /** The only read in the codebase that returns `passwordHash`. */
  findCredentialsByEmail(email: string): Promise<UserRow | undefined>;
  findUserById(id: string): Promise<PublicUser | undefined>;
  findByOauthIdentity(
    provider: string,
    providerUserId: string
  ): Promise<PublicUser | undefined>;
  findUserByEmail(email: string): Promise<PublicUser | undefined>;
  linkOauthIdentity(
    provider: string,
    providerUserId: string,
    userId: string
  ): Promise<void>;
  createOauthUser(input: {
    email: string;
    name: string;
    role: Role;
  }): Promise<PublicUser>;
}

export function createAuthRepo(db: DB): AuthRepo {
  return {
    async findCredentialsByEmail(email) {
      return db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst();
    },

    async findUserById(id) {
      return db
        .selectFrom('users')
        .select(PUBLIC_USER_COLUMNS)
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async findUserByEmail(email) {
      return db
        .selectFrom('users')
        .select(PUBLIC_USER_COLUMNS)
        .where('email', '=', email)
        .executeTakeFirst();
    },

    async findByOauthIdentity(provider, providerUserId) {
      return db
        .selectFrom('oauthIdentities')
        .innerJoin('users', 'users.id', 'oauthIdentities.userId')
        .select([
          'users.id as id',
          'users.email as email',
          'users.name as name',
          'users.role as role',
          'users.suspended as suspended',
          'users.createdAt as createdAt',
          'users.updatedAt as updatedAt',
        ])
        .where('oauthIdentities.provider', '=', provider)
        .where('oauthIdentities.providerUserId', '=', providerUserId)
        .executeTakeFirst();
    },

    async linkOauthIdentity(provider, providerUserId, userId) {
      await db
        .insertInto('oauthIdentities')
        .values({ provider, providerUserId, userId })
        .onConflict((oc) =>
          oc.columns(['provider', 'providerUserId']).doUpdateSet({ userId })
        )
        .execute();
    },

    async createOauthUser(input) {
      return db
        .insertInto('users')
        .values({ ...input, passwordHash: null })
        .returning(PUBLIC_USER_COLUMNS)
        .executeTakeFirstOrThrow();
    },
  };
}
