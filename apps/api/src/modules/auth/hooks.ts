import type {
  onRequestAsyncHookHandler,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors.ts';
import type { PublicUser, Role } from '../../infra/schema.ts';
import type { ClassesService } from '../classes/classes.service.ts';
import type { AuthService } from './auth.service.ts';
import { ACCESS_COOKIE } from './cookies.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireAuth`; undefined on unauthenticated routes. */
    user?: PublicUser;
  }
}

export interface AuthHooks {
  requireAuth: onRequestAsyncHookHandler;
  requireRole(...roles: Role[]): onRequestAsyncHookHandler;
  requireClassTeacher: preHandlerAsyncHookHandler;
  requireSelfOr(...roles: Role[]): preHandlerAsyncHookHandler;
}

function bearerOrCookie(request: {
  headers: Record<string, unknown>;
  cookies: Record<string, string | undefined>;
}): string | undefined {
  const header = request.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return request.cookies[ACCESS_COOKIE];
}

/**
 * Fastify has no middleware; authorization is expressed as hooks registered
 * inside a plugin's scope, so `app.register(usersRoutes, ...)` can be made
 * admin-only in one line without touching any handler.
 */
export function createAuthHooks(
  auth: AuthService,
  classes: ClassesService
): AuthHooks {
  const requireAuth: onRequestAsyncHookHandler = async (request) => {
    const token = bearerOrCookie(request);
    if (!token) throw new UnauthorizedError('Authentication required');
    request.user = await auth.authenticate(token);
  };

  function currentUser(request: { user?: PublicUser }): PublicUser {
    if (!request.user) {
      // Signals a wiring mistake: an authorization hook ran without requireAuth.
      throw new UnauthorizedError('Authentication required');
    }
    return request.user;
  }

  return {
    requireAuth,

    requireRole(...roles) {
      return async (request) => {
        const user = currentUser(request);
        if (!roles.includes(user.role)) {
          throw new ForbiddenError(
            `This action requires the ${roles.join(' or ')} role`
          );
        }
      };
    },

    /** The signed-in teacher must own the class named by `:id` or `:classId`. */
    requireClassTeacher: async (request) => {
      const user = currentUser(request);
      if (user.role === 'admin') return;
    
      const params = (request.params ?? {}) as {
        id?: string;
        classId?: string;
      };
      const classId = params.classId ?? params.id;
      if (!classId) throw new ForbiddenError('No class in this request');

      const found = await classes.requireClass(classId);
      if (found.teacherId !== user.id) {
        throw new ForbiddenError('You do not teach this class');
      }
    },

    /** Students may only reach their own `/students/:studentId/*` views. */
    requireSelfOr(...roles) {
      return async (request) => {
        const user = currentUser(request);
        if (roles.includes(user.role)) return;

        const { studentId } = (request.params ?? {}) as { studentId?: string };
        if (studentId !== user.id) {
          throw new ForbiddenError('You may only access your own records');
        }
      };
    },
  };
}
