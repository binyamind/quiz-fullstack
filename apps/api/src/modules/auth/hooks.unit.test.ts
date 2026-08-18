import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { AuthService } from './auth.service.ts';
import { createAuthHooks } from './hooks.ts';

const auth = {} as AuthService;
const classes = {
  async requireClass(id: string) {
    return { id, teacherId: 'teacher-1' };
  },
} as unknown as ClassesService;

const hooks = createAuthHooks(auth, classes);

/** The hooks read only `user` and `params`, so a stub request is enough. */
function request(partial: Record<string, unknown>): FastifyRequest {
  return partial as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;
const done = () => {};

describe('requireRole', () => {
  it('rejects an unauthenticated request rather than reading a missing user', async () => {
    // Guards against a wiring mistake: an authorization hook without requireAuth.
    await expect(
      hooks.requireRole('admin')(request({}), reply, done)
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('requireClassTeacher', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(
      hooks.requireClassTeacher(request({ params: {} }), reply, done)
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lets an admin through without looking up the class', async () => {
    await expect(
      hooks.requireClassTeacher(
        request({ user: { id: 'a-1', role: 'admin' }, params: {} }),
        reply,
        done
      )
    ).resolves.toBeUndefined();
  });

  it('refuses when the request names no class', async () => {
    await expect(
      hooks.requireClassTeacher(
        request({ user: { id: 'teacher-1', role: 'teacher' }, params: {} }),
        reply,
        done
      )
    ).rejects.toThrow('No class in this request');
  });

  it('refuses when the request carries no params at all', async () => {
    await expect(
      hooks.requireClassTeacher(
        request({ user: { id: 'teacher-1', role: 'teacher' } }),
        reply,
        done
      )
    ).rejects.toThrow('No class in this request');
  });

  it('accepts the class owner via :id', async () => {
    await expect(
      hooks.requireClassTeacher(
        request({
          user: { id: 'teacher-1', role: 'teacher' },
          params: { id: 'c-1' },
        }),
        reply,
        done
      )
    ).resolves.toBeUndefined();
  });

  it('accepts the class owner via :classId', async () => {
    await expect(
      hooks.requireClassTeacher(
        request({
          user: { id: 'teacher-1', role: 'teacher' },
          params: { classId: 'c-1' },
        }),
        reply,
        done
      )
    ).resolves.toBeUndefined();
  });

  it('refuses a teacher who does not own the class', async () => {
    await expect(
      hooks.requireClassTeacher(
        request({
          user: { id: 'teacher-2', role: 'teacher' },
          params: { id: 'c-1' },
        }),
        reply,
        done
      )
    ).rejects.toThrow('You do not teach this class');
  });
});

describe('requireSelfOr', () => {
  it('rejects an unauthenticated request', async () => {
    await expect(
      hooks.requireSelfOr('admin')(request({ params: {} }), reply, done)
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lets a listed role through regardless of the student in the url', async () => {
    await expect(
      hooks.requireSelfOr('admin', 'teacher')(
        request({
          user: { id: 't-1', role: 'teacher' },
          params: { studentId: 's-9' },
        }),
        reply,
        done
      )
    ).resolves.toBeUndefined();
  });

  it('lets a student reach their own records', async () => {
    await expect(
      hooks.requireSelfOr('admin')(
        request({
          user: { id: 's-1', role: 'student' },
          params: { studentId: 's-1' },
        }),
        reply,
        done
      )
    ).resolves.toBeUndefined();
  });

  it("refuses a student reading someone else's records", async () => {
    await expect(
      hooks.requireSelfOr('admin')(
        request({
          user: { id: 's-1', role: 'student' },
          params: { studentId: 's-2' },
        }),
        reply,
        done
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuses a student request that carries no params', async () => {
    await expect(
      hooks.requireSelfOr('admin')(
        request({ user: { id: 's-1', role: 'student' } }),
        reply,
        done
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
