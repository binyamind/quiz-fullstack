import type {
  FastifyPluginAsync,
  onRequestAsyncHookHandler,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { parse } from '../../shared/validation.ts';
import {
  classIdParams,
  classStudentParams,
  createClassSchema,
  enrollStudentSchema,
  listClassesQuerySchema,
  updateClassSchema,
} from './classes.schema.ts';
import type { ClassesService } from './classes.service.ts';

export interface ClassesRoutesGuards {
  /** Any teacher or admin — used for "create a class". */
  requireTeacher: onRequestAsyncHookHandler;
  /** The teacher of the class named in the route, or an admin. */
  requireClassTeacher: preHandlerAsyncHookHandler;
}

export function classesRoutes(
  classes: ClassesService,
  guards: ClassesRoutesGuards
): FastifyPluginAsync {
  return async (app) => {
    app.post(
      '/',
      { onRequest: guards.requireTeacher },
      async (request, reply) => {
        const created = await classes.create(
          parse(createClassSchema, request.body)
        );
        return reply.code(201).send(created);
      }
    );

    app.get('/', async (request) => {
      const query = parse(listClassesQuerySchema, request.query);
      return {
        data: await classes.list(query),
        limit: query.limit,
        offset: query.offset,
      };
    });

    app.get('/:id', async (request) => {
      const { id } = parse(classIdParams, request.params);
      return classes.getById(id);
    });

    app.patch(
      '/:id',
      { preHandler: guards.requireClassTeacher },
      async (request) => {
        const { id } = parse(classIdParams, request.params);
        return classes.update(id, parse(updateClassSchema, request.body));
      }
    );

    app.delete(
      '/:id',
      { preHandler: guards.requireClassTeacher },
      async (request, reply) => {
        const { id } = parse(classIdParams, request.params);
        await classes.remove(id);
        return reply.code(204).send();
      }
    );

    app.get('/:id/students', async (request) => {
      const { id } = parse(classIdParams, request.params);
      return { data: await classes.listStudents(id) };
    });

    app.post(
      '/:id/students',
      { preHandler: guards.requireClassTeacher },
      async (request, reply) => {
        const { id } = parse(classIdParams, request.params);
        const { studentId } = parse(enrollStudentSchema, request.body);
        const students = await classes.enroll(id, studentId);
        return reply.code(201).send({ data: students });
      }
    );

    app.delete(
      '/:id/students/:studentId',
      { preHandler: guards.requireClassTeacher },
      async (request, reply) => {
        const { id, studentId } = parse(classStudentParams, request.params);
        await classes.unenroll(id, studentId);
        return reply.code(204).send();
      }
    );
  };
}
