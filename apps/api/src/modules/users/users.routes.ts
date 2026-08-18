import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../shared/validation.ts';
import {
  createUserSchema,
  listUsersQuerySchema,
  setPasswordSchema,
  updateUserSchema,
  userIdParams,
} from './users.schema.ts';
import type { UsersService } from './users.service.ts';

export function usersRoutes(users: UsersService): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (request, reply) => {
      const created = await users.create(parse(createUserSchema, request.body));
      return reply.code(201).send(created);
    });

    app.get('/', async (request) => {
      const query = parse(listUsersQuerySchema, request.query);
      return {
        data: await users.list(query),
        limit: query.limit,
        offset: query.offset,
      };
    });

    app.get('/:id', async (request) => {
      const { id } = parse(userIdParams, request.params);
      return users.getById(id);
    });

    app.patch('/:id', async (request) => {
      const { id } = parse(userIdParams, request.params);
      return users.update(id, parse(updateUserSchema, request.body));
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parse(userIdParams, request.params);
      await users.remove(id);
      return reply.code(204).send();
    });

    app.patch('/:id/suspend', async (request) => {
      const { id } = parse(userIdParams, request.params);
      return users.setSuspended(id, true);
    });

    app.patch('/:id/unsuspend', async (request) => {
      const { id } = parse(userIdParams, request.params);
      return users.setSuspended(id, false);
    });

    app.put('/:id/password', async (request, reply) => {
      const { id } = parse(userIdParams, request.params);
      const { password } = parse(setPasswordSchema, request.body);
      await users.setPassword(id, password);
      return reply.code(204).send();
    });
  };
}
