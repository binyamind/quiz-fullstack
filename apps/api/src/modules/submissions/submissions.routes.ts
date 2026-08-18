import type { FastifyPluginAsync, onRequestAsyncHookHandler } from 'fastify';
import { ForbiddenError, ValidationError } from '../../shared/errors.ts';
import { parse } from '../../shared/validation.ts';
import {
  assignmentIdParams,
  createSubmissionSchema,
  gradeSubmissionSchema,
  listSubmissionsQuerySchema,
  submissionIdParams,
  updateSubmissionSchema,
} from './submissions.schema.ts';
import type { SubmissionsService } from './submissions.service.ts';

/** Mounted at /api/v0/assignments/:assignmentId/submissions. */
export function assignmentSubmissionsRoutes(
  submissions: SubmissionsService,
  guards: { requireTeacher: onRequestAsyncHookHandler }
): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (request, reply) => {
      const { assignmentId } = parse(assignmentIdParams, request.params);
      const body = parse(createSubmissionSchema, request.body);
      const actor = request.user!;

      // A student always submits as themselves; staff must name the student.
      let studentId: string;
      if (actor.role === 'student') {
        if (body.studentId && body.studentId !== actor.id) {
          throw new ForbiddenError('You may only submit your own work');
        }
        studentId = actor.id;
      } else {
        if (!body.studentId) {
          throw new ValidationError(
            'studentId is required when submitting on behalf of a student'
          );
        }
        studentId = body.studentId;
      }

      const created = await submissions.submit(assignmentId, {
        studentId,
        content: body.content,
      });
      return reply.code(201).send(created);
    });

    // The whole class's submissions are a grading view, so staff only.
    app.get('/', { onRequest: guards.requireTeacher }, async (request) => {
      const { assignmentId } = parse(assignmentIdParams, request.params);
      const query = parse(listSubmissionsQuerySchema, request.query);
      return {
        data: await submissions.listByAssignment(assignmentId, query),
        limit: query.limit,
        offset: query.offset,
      };
    });
  };
}

/** Mounted at /api/v0/submissions. */
export function submissionsRoutes(
  submissions: SubmissionsService,
  guards: { requireTeacher: onRequestAsyncHookHandler }
): FastifyPluginAsync {
  return async (app) => {
    app.get('/:id', async (request) => {
      const { id } = parse(submissionIdParams, request.params);
      const submission = await submissions.getById(id);
      const actor = request.user!;
      if (actor.role === 'student' && submission.studentId !== actor.id) {
        throw new ForbiddenError('You may only read your own submissions');
      }
      return submission;
    });

    app.patch('/:id', async (request) => {
      const { id } = parse(submissionIdParams, request.params);
      const actor = request.user!;
      const existing = await submissions.getById(id);
      if (actor.role === 'student' && existing.studentId !== actor.id) {
        throw new ForbiddenError('You may only edit your own submissions');
      }
      return submissions.updateContent(
        id,
        parse(updateSubmissionSchema, request.body)
      );
    });

    app.patch(
      '/:id/grade',
      { onRequest: guards.requireTeacher },
      async (request) => {
        const { id } = parse(submissionIdParams, request.params);
        return submissions.grade(
          id,
          parse(gradeSubmissionSchema, request.body)
        );
      }
    );

    app.delete(
      '/:id',
      { onRequest: guards.requireTeacher },
      async (request, reply) => {
        const { id } = parse(submissionIdParams, request.params);
        await submissions.remove(id);
        return reply.code(204).send();
      }
    );
  };
}
