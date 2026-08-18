import { NotFoundError } from '../../shared/errors.ts';
import type { AssignmentRow } from '../../infra/schema.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { UsersService } from '../users/users.service.ts';
import type { AssignmentsRepo } from './assignments.repo.ts';
import type {
  CreateAssignmentInput,
  ListAssignmentsQuery,
  UpdateAssignmentInput,
} from './assignments.schema.ts';

export interface AssignmentsService {
  create(classId: string, input: CreateAssignmentInput): Promise<AssignmentRow>;
  getById(id: string): Promise<AssignmentRow>;
  requireAssignment(id: string): Promise<AssignmentRow>;
  listByClass(
    classId: string,
    query: ListAssignmentsQuery
  ): Promise<AssignmentRow[]>;
  listForStudent(
    studentId: string,
    query: ListAssignmentsQuery
  ): Promise<AssignmentRow[]>;
  update(id: string, input: UpdateAssignmentInput): Promise<AssignmentRow>;
  setPublished(id: string, published: boolean): Promise<AssignmentRow>;
  remove(id: string): Promise<void>;
}

export function createAssignmentsService(
  repo: AssignmentsRepo,
  classes: ClassesService,
  users: UsersService
): AssignmentsService {
  async function requireAssignment(id: string): Promise<AssignmentRow> {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError('Assignment', id);
    return found;
  }

  return {
    requireAssignment,
    getById: requireAssignment,

    async create(classId, input) {
      await classes.requireClass(classId);
      return repo.create(classId, input);
    },

    async listByClass(classId, query) {
      await classes.requireClass(classId);
      return repo.listByClass(classId, query);
    },

    async listForStudent(studentId, query) {
      await users.requireRole(studentId, 'student');
      return repo.listForStudent(studentId, query);
    },

    async update(id, input) {
      const updated = await repo.update(id, input);
      if (!updated) throw new NotFoundError('Assignment', id);
      return updated;
    },

    async setPublished(id, published) {
      const updated = await repo.setPublished(id, published);
      if (!updated) throw new NotFoundError('Assignment', id);
      return updated;
    },

    async remove(id) {
      const deleted = await repo.remove(id);
      if (!deleted) throw new NotFoundError('Assignment', id);
    },
  };
}
