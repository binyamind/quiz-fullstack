import type { FastifyPluginAsync } from 'fastify';
import { listQuery, parse } from '../../shared/validation.ts';
import {
  addMemberSchema,
  createTeacherGroupSchema,
  groupIdParams,
  memberParams,
  updateTeacherGroupSchema,
} from './teacher-groups.schema.ts';
import type { TeacherGroupsService } from './teacher-groups.service.ts';

export function teacherGroupsRoutes(
  groups: TeacherGroupsService
): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (request, reply) => {
      const created = await groups.create(
        parse(createTeacherGroupSchema, request.body)
      );
      return reply.code(201).send(created);
    });

    app.get('/', async (request) => {
      const query = parse(listQuery, request.query);
      return {
        data: await groups.list(query),
        limit: query.limit,
        offset: query.offset,
      };
    });

    app.get('/:id', async (request) => {
      const { id } = parse(groupIdParams, request.params);
      return groups.getById(id);
    });

    app.patch('/:id', async (request) => {
      const { id } = parse(groupIdParams, request.params);
      return groups.update(id, parse(updateTeacherGroupSchema, request.body));
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parse(groupIdParams, request.params);
      await groups.remove(id);
      return reply.code(204).send();
    });

    app.get('/:id/members', async (request) => {
      const { id } = parse(groupIdParams, request.params);
      return { data: await groups.listMembers(id) };
    });

    app.post('/:id/members', async (request, reply) => {
      const { id } = parse(groupIdParams, request.params);
      const { teacherId } = parse(addMemberSchema, request.body);
      const members = await groups.addMember(id, teacherId);
      return reply.code(201).send({ data: members });
    });

    app.delete('/:id/members/:teacherId', async (request, reply) => {
      const { id, teacherId } = parse(memberParams, request.params);
      await groups.removeMember(id, teacherId);
      return reply.code(204).send();
    });
  };
}
