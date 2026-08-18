import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.ts';
import type { SubmissionRow } from '../../infra/schema.ts';
import type { AssignmentsService } from '../assignments/assignments.service.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { UsersService } from '../users/users.service.ts';
import type { SubmissionsRepo } from './submissions.repo.ts';
import type {
  GradeSubmissionInput,
  ListSubmissionsQuery,
  UpdateSubmissionInput,
} from './submissions.schema.ts';

/** The route resolves who is submitting before calling the service. */
export interface SubmitInput {
  studentId: string;
  content: string;
}

export interface SubmissionsService {
  submit(assignmentId: string, input: SubmitInput): Promise<SubmissionRow>;
  getById(id: string): Promise<SubmissionRow>;
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
    input: UpdateSubmissionInput
  ): Promise<SubmissionRow>;
  grade(id: string, input: GradeSubmissionInput): Promise<SubmissionRow>;
  remove(id: string): Promise<void>;
}

export function createSubmissionsService(
  repo: SubmissionsRepo,
  assignments: AssignmentsService,
  classes: ClassesService,
  users: UsersService
): SubmissionsService {
  async function requireSubmission(id: string): Promise<SubmissionRow> {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError('Submission', id);
    return found;
  }

  return {
    getById: requireSubmission,

    async submit(assignmentId, input) {
      const assignment = await assignments.requireAssignment(assignmentId);
      if (!assignment.published)
        throw new ConflictError('Assignment is not published');
      await users.requireRole(input.studentId, 'student');
      await classes.requireEnrolled(assignment.classId, input.studentId);

      const existing = await repo.findByAssignmentAndStudent(
        assignmentId,
        input.studentId
      );
      if (existing)
        throw new ConflictError(
          'Student has already submitted this assignment'
        );

      return repo.create({
        assignmentId,
        studentId: input.studentId,
        content: input.content,
      });
    },

    async listByAssignment(assignmentId, query) {
      await assignments.requireAssignment(assignmentId);
      return repo.listByAssignment(assignmentId, query);
    },

    async listByStudent(studentId, query) {
      await users.requireRole(studentId, 'student');
      return repo.listByStudent(studentId, query);
    },

    async updateContent(id, input) {
      const submission = await requireSubmission(id);
      if (submission.grade !== null)
        throw new ConflictError('Cannot edit a graded submission');
      const updated = await repo.updateContent(id, input.content);
      if (!updated) throw new NotFoundError('Submission', id);
      return updated;
    },

    async grade(id, input) {
      const submission = await requireSubmission(id);
      const assignment = await assignments.requireAssignment(
        submission.assignmentId
      );
      if (input.grade > assignment.maxGrade) {
        throw new ValidationError(
          `Grade exceeds the assignment maximum of ${assignment.maxGrade}`
        );
      }
      const graded = await repo.grade(id, input);
      if (!graded) throw new NotFoundError('Submission', id);
      return graded;
    },

    async remove(id) {
      const deleted = await repo.remove(id);
      if (!deleted) throw new NotFoundError('Submission', id);
    },
  };
}
