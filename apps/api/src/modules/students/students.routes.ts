import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { parse, uuid } from '../../shared/validation.ts';
import { listAssignmentsQuerySchema } from '../assignments/assignments.schema.ts';
import { listSubmissionsQuerySchema } from '../submissions/submissions.schema.ts';
import type { AssignmentsService } from '../assignments/assignments.service.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { SubmissionsService } from '../submissions/submissions.service.ts';

const studentIdParams = z.object({ studentId: uuid });
const listClassesForStudentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Mounted at /api/v0/students/:studentId — read-only views answering the Student
 * role's three questions in one request each. `requireSelfOrStaff` is added as a
 * hook on the whole scope, so a student can only ever read their own records.
 */
export function studentsRoutes(
  classes: ClassesService,
  assignments: AssignmentsService,
  submissions: SubmissionsService,
  guards: { requireSelfOrStaff: preHandlerAsyncHookHandler }
): FastifyPluginAsync {
  return async (app) => {
    app.addHook('preHandler', guards.requireSelfOrStaff);

    app.get('/classes', async (request) => {
      const { studentId } = parse(studentIdParams, request.params);
      const query = parse(listClassesForStudentQuery, request.query);
      return { data: await classes.list({ studentId, ...query }) };
    });

    app.get('/assignments', async (request) => {
      const { studentId } = parse(studentIdParams, request.params);
      const query = parse(listAssignmentsQuerySchema, request.query);
      return { data: await assignments.listForStudent(studentId, query) };
    });

    app.get('/submissions', async (request) => {
      const { studentId } = parse(studentIdParams, request.params);
      const query = parse(listSubmissionsQuerySchema, request.query);
      return { data: await submissions.listByStudent(studentId, query) };
    });
  };
}
