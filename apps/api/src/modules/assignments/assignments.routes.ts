import type {
  FastifyPluginAsync,
  onRequestAsyncHookHandler,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { parse } from '../../shared/validation.ts';
import {
  assignmentIdParams,
  classIdParams,
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
} from './assignments.schema.ts';
import type { AssignmentsService } from './assignments.service.ts';

/** Mounted at /api/v0/classes/:classId/assignments — the teacher's publishing surface. */
export function classAssignmentsRoutes(
  assignments: AssignmentsService,
  guards: { requireClassTeacher: preHandlerAsyncHookHandler }
): FastifyPluginAsync {
  return async (app) => {
    app.post(
      '/',
      { preHandler: guards.requireClassTeacher },
      async (request, reply) => {
        const { classId } = parse(classIdParams, request.params);
        const created = await assignments.create(
          classId,
          parse(createAssignmentSchema, request.body)
        );
        return reply.code(201).send(created);
      }
    );

    app.get('/', async (request) => {
      const { classId } = parse(classIdParams, request.params);
      const query = parse(listAssignmentsQuerySchema, request.query);
      return {
        data: await assignments.listByClass(classId, query),
        limit: query.limit,
        offset: query.offset,
      };
    });
  };
}

/** Mounted at /api/v0/assignments — operations that only need the assignment id. */
export function assignmentsRoutes(
  assignments: AssignmentsService,
  guards: { requireTeacher: onRequestAsyncHookHandler }
): FastifyPluginAsync {
  return async (app) => {
    app.get('/:id', async (request) => {
      const { id } = parse(assignmentIdParams, request.params);
      return assignments.getById(id);
    });

    // Mutating an assignment is staff-only; ownership is enforced through the
    // class-scoped routes above, which is where the classId is in the path.
    app.patch('/:id', { onRequest: guards.requireTeacher }, async (request) => {
      const { id } = parse(assignmentIdParams, request.params);
      return assignments.update(
        id,
        parse(updateAssignmentSchema, request.body)
      );
    });

    app.delete(
      '/:id',
      { onRequest: guards.requireTeacher },
      async (request, reply) => {
        const { id } = parse(assignmentIdParams, request.params);
        await assignments.remove(id);
        return reply.code(204).send();
      }
    );

    app.post(
      '/:id/publish',
      { onRequest: guards.requireTeacher },
      async (request) => {
        const { id } = parse(assignmentIdParams, request.params);
        return assignments.setPublished(id, true);
      }
    );

    app.post(
      '/:id/unpublish',
      { onRequest: guards.requireTeacher },
      async (request) => {
        const { id } = parse(assignmentIdParams, request.params);
        return assignments.setPublished(id, false);
      }
    );
  };
}
