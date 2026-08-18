import { ConflictError, NotFoundError } from '../../shared/errors.ts';
import { hashPassword } from '../../shared/password.ts';
import type { PublicUser, Role } from '../../infra/schema.ts';
import type { UsersRepo } from './users.repo.ts';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from './users.schema.ts';

export interface UsersService {
  create(input: CreateUserInput): Promise<PublicUser>;
  getById(id: string): Promise<PublicUser>;
  list(query: ListUsersQuery): Promise<PublicUser[]>;
  update(id: string, input: UpdateUserInput): Promise<PublicUser>;
  setSuspended(id: string, suspended: boolean): Promise<PublicUser>;
  setPassword(id: string, password: string): Promise<void>;
  remove(id: string): Promise<void>;
  requireRole(id: string, role: Role): Promise<PublicUser>;
}

export function createUsersService(repo: UsersRepo): UsersService {
  async function getById(id: string): Promise<PublicUser> {
    const user = await repo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  return {
    getById,

    async create({ password, ...input }) {
      const existing = await repo.findByEmail(input.email);
      if (existing)
        throw new ConflictError(
          `A user with email '${input.email}' already exists`
        );
      return repo.create({
        ...input,
        passwordHash: password ? await hashPassword(password) : null,
      });
    },

    async setPassword(id, password) {
      const updated = await repo.setPasswordHash(
        id,
        await hashPassword(password)
      );
      if (!updated) throw new NotFoundError('User', id);
    },

    async list(query) {
      return repo.list(query);
    },

    async update(id, input) {
      if (input.email) {
        const existing = await repo.findByEmail(input.email);
        if (existing && existing.id !== id)
          throw new ConflictError(
            `A user with email '${input.email}' already exists`
          );
      }
      const updated = await repo.update(id, input);
      if (!updated) throw new NotFoundError('User', id);
      return updated;
    },

    async setSuspended(id, suspended) {
      const updated = await repo.setSuspended(id, suspended);
      if (!updated) throw new NotFoundError('User', id);
      return updated;
    },

    async remove(id) {
      const deleted = await repo.remove(id);
      if (!deleted) throw new NotFoundError('User', id);
    },

    /** Guards references from other modules, e.g. "this id must be a teacher". */
    async requireRole(id, role) {
      const user = await getById(id);
      if (user.role !== role)
        throw new ConflictError(`User '${id}' is not a ${role}`);
      return user;
    },
  };
}
