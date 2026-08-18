import Fastify, { type FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import type { Redis } from 'ioredis';
import type { DB } from './infra/db.ts';
import type { Role } from './infra/schema.ts';
import { registerErrorHandler } from './shared/error-handler.ts';
import {
  createNoopCache,
  createRedisCache,
  type Cache,
} from './shared/cache.ts';
import { ValidationError } from './shared/errors.ts';
import { createUsersRepo } from './modules/users/users.repo.ts';
import { createUsersService } from './modules/users/users.service.ts';
import { usersRoutes } from './modules/users/users.routes.ts';
import { createTeacherGroupsRepo } from './modules/teacher-groups/teacher-groups.repo.ts';
import { createTeacherGroupsService } from './modules/teacher-groups/teacher-groups.service.ts';
import { teacherGroupsRoutes } from './modules/teacher-groups/teacher-groups.routes.ts';
import { createClassesRepo } from './modules/classes/classes.repo.ts';
import { createClassesService } from './modules/classes/classes.service.ts';
import { classesRoutes } from './modules/classes/classes.routes.ts';
import { createAssignmentsRepo } from './modules/assignments/assignments.repo.ts';
import { createAssignmentsService } from './modules/assignments/assignments.service.ts';
import {
  assignmentsRoutes,
  classAssignmentsRoutes,
} from './modules/assignments/assignments.routes.ts';
import { createSubmissionsRepo } from './modules/submissions/submissions.repo.ts';
import { createSubmissionsService } from './modules/submissions/submissions.service.ts';
import {
  assignmentSubmissionsRoutes,
  submissionsRoutes,
} from './modules/submissions/submissions.routes.ts';
import { studentsRoutes } from './modules/students/students.routes.ts';
import { createStatsRepo } from './modules/stats/stats.repo.ts';
import {
  createStatsService,
  STATS_CACHE_PREFIX,
} from './modules/stats/stats.service.ts';
import { statsRoutes } from './modules/stats/stats.routes.ts';
import { createChatService } from './modules/chat/chat.service.ts';
import { chatRoutes } from './modules/chat/chat.routes.ts';
import { createClaudeClient } from './modules/chat/claude.ts';
import { createAuthRepo } from './modules/auth/auth.repo.ts';
import { createAuthService } from './modules/auth/auth.service.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { createAuthHooks } from './modules/auth/hooks.ts';
import { createTokens } from './modules/auth/tokens.ts';
import {
  createGitHubProvider,
  type OAuthProvider,
} from './modules/auth/github.ts';
import {
  createMemorySessionStore,
  createRedisSessionStore,
  type SessionStore,
} from './modules/auth/session-store.ts';

export interface BuildAppOptions {
  db: DB;
  logger?: boolean | { level: string };
  corsOrigin?: string | string[];
  auth: {
    jwtSecret: string;
    accessTtlSeconds?: number;
    refreshTtlSeconds?: number;
    cookieSecure?: boolean;
    cookieDomain?: string;
    /** Role given to accounts provisioned on first OAuth sign-in. */
    oauthDefaultRole?: Role;
    oauthSuccessRedirect?: string;
    github?: { clientId: string; clientSecret: string; redirectUri: string };
  };
  /** Omitted in tests, which fall back to the in-memory session store. */
  redis?: Redis;
  sessionStore?: SessionStore;
  oauthProvider?: OAuthProvider;
  cache?: Cache;
  statsCacheTtlSeconds?: number;
  chat?: { apiKey: string; model?: string; fetchImpl?: typeof fetch };
}

const API_PREFIX = '/api/v0';

/**
 * Wires repos → services → route plugins and returns an unstarted instance.
 * Tests use `app.inject()` against this; only `server.ts` calls `listen()`.
 */
export async function buildApp({
  db,
  logger = false,
  corsOrigin,
  auth: authConfig,
  redis,
  sessionStore,
  oauthProvider,
  cache,
  statsCacheTtlSeconds,
  chat,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(cors, { origin: corsOrigin ?? true, credentials: true });
  await app.register(cookie);

  /**
   * Action endpoints such as `POST /assignments/:id/publish` carry no body.
   * Fastify's default JSON parser rejects an empty payload when clients still
   * send `content-type: application/json`, so treat empty as `{}`.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const raw = (body as string).trim();
      if (raw.length === 0) return done(null, {});
      try {
        done(null, JSON.parse(raw));
      } catch {
        done(new ValidationError('Body is not valid JSON'), undefined);
      }
    }
  );

  registerErrorHandler(app);

  const users = createUsersService(createUsersRepo(db));
  const teacherGroups = createTeacherGroupsService(
    createTeacherGroupsRepo(db),
    users
  );
  const classes = createClassesService(createClassesRepo(db), users);
  const assignments = createAssignmentsService(
    createAssignmentsRepo(db),
    classes,
    users
  );
  const submissions = createSubmissionsService(
    createSubmissionsRepo(db),
    assignments,
    classes,
    users
  );
  const statsCache =
    cache ?? (redis ? createRedisCache(redis) : createNoopCache());
  const stats = createStatsService(createStatsRepo(db), classes, {
    cache: statsCache,
    ttlSeconds: statsCacheTtlSeconds ?? 30,
  });

  /**
   * Any successful write can move a school-wide aggregate, so one hook clears
   * the stats namespace instead of every service knowing about the cache.
   */
  app.addHook('onResponse', async (request, reply) => {
    if (request.method === 'GET' || reply.statusCode >= 400) return;
    try {
      await statsCache.invalidate(STATS_CACHE_PREFIX);
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to invalidate the stats cache');
    }
  });

  const accessTtlSeconds = authConfig.accessTtlSeconds ?? 900;
  const refreshTtlSeconds = authConfig.refreshTtlSeconds ?? 604800;
  const tokens = createTokens({
    secret: authConfig.jwtSecret,
    accessTtlSeconds,
    refreshTtlSeconds,
  });
  const sessions =
    sessionStore ??
    (redis ? createRedisSessionStore(redis) : createMemorySessionStore());
  const authService = createAuthService(createAuthRepo(db), tokens, sessions);
  const hooks = createAuthHooks(authService, classes);

  const chatService = chat
    ? createChatService(
        createClaudeClient({
          apiKey: chat.apiKey,
          model: chat.model ?? 'claude-opus-5',
          fetchImpl: chat.fetchImpl,
        }),
        classes,
        assignments,
        submissions,
        stats
      )
    : undefined;

  const provider =
    oauthProvider ??
    (authConfig.github ? createGitHubProvider(authConfig.github) : undefined);

  /**
   * Liveness only — the process is up. Container healthchecks use /ready, which
   * actually touches the dependencies.
   */
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await sql`SELECT 1`.execute(db);
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    if (redis) {
      try {
        await redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'error';
      }
    }

    const healthy = Object.values(checks).every((value) => value === 'ok');
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ready' : 'degraded',
      checks,
    });
  });

  await app.register(
    authRoutes({
      auth: authService,
      hooks,
      cookies: {
        secure: authConfig.cookieSecure ?? false,
        domain: authConfig.cookieDomain,
        accessTtlSeconds,
        refreshTtlSeconds,
      },
      oauthProvider: provider,
      oauthSuccessRedirect:
        authConfig.oauthSuccessRedirect ?? 'http://localhost:3000',
      oauthDefaultRole: authConfig.oauthDefaultRole ?? 'student',
    }),
    { prefix: `${API_PREFIX}/auth` }
  );

  /**
   * Each group below is its own encapsulated plugin scope, so the hooks added
   * inside apply to that group's routes only — this is Fastify's stand-in for
   * per-module guards, and the reason no handler checks a role itself.
   */
  const adminOnly = async (instance: FastifyInstance) => {
    instance.addHook('onRequest', hooks.requireAuth);
    instance.addHook('onRequest', hooks.requireRole('admin'));
    await instance.register(usersRoutes(users), { prefix: '/users' });
    await instance.register(teacherGroupsRoutes(teacherGroups), {
      prefix: '/teacher-groups',
    });
  };

  const teachingRoutes = async (instance: FastifyInstance) => {
    instance.addHook('onRequest', hooks.requireAuth);

    // Reading a class is open to any signed-in user; writing is teacher/admin
    // and, for a specific class, restricted to that class's teacher.
    await instance.register(
      classesRoutes(classes, {
        requireTeacher: hooks.requireRole('teacher', 'admin'),
        requireClassTeacher: hooks.requireClassTeacher,
      }),
      { prefix: '/classes' }
    );
    await instance.register(
      classAssignmentsRoutes(assignments, {
        requireClassTeacher: hooks.requireClassTeacher,
      }),
      { prefix: '/classes/:classId/assignments' }
    );
    await instance.register(
      assignmentsRoutes(assignments, {
        requireTeacher: hooks.requireRole('teacher', 'admin'),
      }),
      { prefix: '/assignments' }
    );
    await instance.register(
      assignmentSubmissionsRoutes(submissions, {
        requireTeacher: hooks.requireRole('teacher', 'admin'),
      }),
      { prefix: '/assignments/:assignmentId/submissions' }
    );
    await instance.register(
      submissionsRoutes(submissions, {
        requireTeacher: hooks.requireRole('teacher', 'admin'),
      }),
      { prefix: '/submissions' }
    );
    await instance.register(
      studentsRoutes(classes, assignments, submissions, {
        requireSelfOrStaff: hooks.requireSelfOr('admin', 'teacher'),
      }),
      { prefix: '/students/:studentId' }
    );
    await instance.register(statsRoutes(stats), { prefix: '/stats' });
    await instance.register(chatRoutes(chatService), { prefix: '/chat' });
  };

  await app.register(adminOnly, { prefix: API_PREFIX });
  await app.register(teachingRoutes, { prefix: API_PREFIX });

  return app;
}
