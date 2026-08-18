import { NotFoundError } from '../../shared/errors.ts';
import type { ClassRow, PublicUser } from '../../infra/schema.ts';
import type { UsersService } from '../users/users.service.ts';
import type { ClassesRepo } from './classes.repo.ts';
import type {
  CreateClassInput,
  ListClassesQuery,
  UpdateClassInput,
} from './classes.schema.ts';

export interface ClassWithRoster extends ClassRow {
  teacher: PublicUser;
  students: PublicUser[];
}

export interface ClassesService {
  create(input: CreateClassInput): Promise<ClassWithRoster>;
  getById(id: string): Promise<ClassWithRoster>;
  requireClass(id: string): Promise<ClassRow>;
  list(query: ListClassesQuery): Promise<ClassRow[]>;
  update(id: string, input: UpdateClassInput): Promise<ClassRow>;
  remove(id: string): Promise<void>;
  listStudents(id: string): Promise<PublicUser[]>;
  enroll(id: string, studentId: string): Promise<PublicUser[]>;
  unenroll(id: string, studentId: string): Promise<void>;
  requireEnrolled(classId: string, studentId: string): Promise<void>;
}

export function createClassesService(
  repo: ClassesRepo,
  users: UsersService
): ClassesService {
  async function requireClass(id: string): Promise<ClassRow> {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError('Class', id);
    return found;
  }

  async function enroll(id: string, studentId: string): Promise<PublicUser[]> {
    await requireClass(id);
    await users.requireRole(studentId, 'student');
    await repo.enroll(id, studentId);
    return repo.listStudents(id);
  }

  return {
    requireClass,
    enroll,

    async create(input) {
      const teacher = await users.requireRole(input.teacherId, 'teacher');
      const created = await repo.create(input);
      for (const studentId of input.studentIds ?? []) {
        await users.requireRole(studentId, 'student');
        await repo.enroll(created.id, studentId);
      }
      return {
        ...created,
        teacher,
        students: await repo.listStudents(created.id),
      };
    },

    async getById(id) {
      const found = await requireClass(id);
      const teacher = await users.getById(found.teacherId);
      return { ...found, teacher, students: await repo.listStudents(id) };
    },

    async list(query) {
      return repo.list(query);
    },

    async update(id, input) {
      if (input.teacherId) await users.requireRole(input.teacherId, 'teacher');
      const updated = await repo.update(id, input);
      if (!updated) throw new NotFoundError('Class', id);
      return updated;
    },

    async remove(id) {
      const deleted = await repo.remove(id);
      if (!deleted) throw new NotFoundError('Class', id);
    },

    async listStudents(id) {
      await requireClass(id);
      return repo.listStudents(id);
    },

    async unenroll(id, studentId) {
      await requireClass(id);
      const removed = await repo.unenroll(id, studentId);
      if (!removed)
        throw new NotFoundError(`Student '${studentId}' in class`, id);
    },

    /** Used by the submissions module to keep non-enrolled students out. */
    async requireEnrolled(classId, studentId) {
      const enrolled = await repo.isEnrolled(classId, studentId);
      if (!enrolled)
        throw new NotFoundError(`Student '${studentId}' in class`, classId);
    },
  };
}
