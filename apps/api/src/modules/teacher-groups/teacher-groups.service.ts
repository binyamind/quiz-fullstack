import { NotFoundError } from '../../shared/errors.ts';
import type { PublicUser, TeacherGroupRow } from '../../infra/schema.ts';
import type { ListQuery } from '../../shared/validation.ts';
import type { UsersService } from '../users/users.service.ts';
import type { TeacherGroupsRepo } from './teacher-groups.repo.ts';
import type {
  CreateTeacherGroupInput,
  UpdateTeacherGroupInput,
} from './teacher-groups.schema.ts';

export interface TeacherGroupWithMembers extends TeacherGroupRow {
  members: PublicUser[];
}

export interface TeacherGroupsService {
  create(input: CreateTeacherGroupInput): Promise<TeacherGroupWithMembers>;
  getById(id: string): Promise<TeacherGroupWithMembers>;
  list(query: ListQuery): Promise<TeacherGroupRow[]>;
  update(id: string, input: UpdateTeacherGroupInput): Promise<TeacherGroupRow>;
  remove(id: string): Promise<void>;
  listMembers(id: string): Promise<PublicUser[]>;
  addMember(id: string, teacherId: string): Promise<PublicUser[]>;
  removeMember(id: string, teacherId: string): Promise<void>;
}

export function createTeacherGroupsService(
  repo: TeacherGroupsRepo,
  users: UsersService
): TeacherGroupsService {
  async function requireGroup(id: string): Promise<TeacherGroupRow> {
    const group = await repo.findById(id);
    if (!group) throw new NotFoundError('Teacher group', id);
    return group;
  }

  async function addMember(
    id: string,
    teacherId: string
  ): Promise<PublicUser[]> {
    await requireGroup(id);
    await users.requireRole(teacherId, 'teacher');
    await repo.addMember(id, teacherId);
    return repo.listMembers(id);
  }

  return {
    addMember,

    async create(input) {
      const group = await repo.create(input);
      for (const teacherId of input.teacherIds ?? []) {
        await users.requireRole(teacherId, 'teacher');
        await repo.addMember(group.id, teacherId);
      }
      return { ...group, members: await repo.listMembers(group.id) };
    },

    async getById(id) {
      const group = await requireGroup(id);
      return { ...group, members: await repo.listMembers(id) };
    },

    async list(query) {
      return repo.list(query);
    },

    async update(id, input) {
      const updated = await repo.update(id, input);
      if (!updated) throw new NotFoundError('Teacher group', id);
      return updated;
    },

    async remove(id) {
      const deleted = await repo.remove(id);
      if (!deleted) throw new NotFoundError('Teacher group', id);
    },

    async listMembers(id) {
      await requireGroup(id);
      return repo.listMembers(id);
    },

    async removeMember(id, teacherId) {
      await requireGroup(id);
      const removed = await repo.removeMember(id, teacherId);
      if (!removed)
        throw new NotFoundError(`Member '${teacherId}' in group`, id);
    },
  };
}
