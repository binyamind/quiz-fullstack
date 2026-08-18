import { randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { UnauthorizedError } from '../../shared/errors.ts';
import { parse } from '../../shared/validation.ts';
import type { Role } from '../../infra/schema.ts';
import type { AuthService } from './auth.service.ts';
import type { AuthHooks } from './hooks.ts';
import type { OAuthProvider } from './github.ts';
import {
  clearSessionCookies,
  OAUTH_STATE_COOKIE,
  REFRESH_COOKIE,
  setSessionCookies,
  type CookieConfig,
} from './cookies.ts';

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export interface AuthRoutesOptions {
  auth: AuthService;
  hooks: AuthHooks;
  cookies: CookieConfig;
  /** Absent when GitHub credentials are not configured. */
  oauthProvider?: OAuthProvider;
  oauthSuccessRedirect: string;
  oauthDefaultRole: Role;
}

export function authRoutes(options: AuthRoutesOptions): FastifyPluginAsync {
  const { auth, hooks, cookies, oauthProvider } = options;

  return async (app) => {
    app.post('/login', async (request, reply) => {
      const { email, password } = parse(loginSchema, request.body);
      const session = await auth.login(email, password);
      setSessionCookies(reply, session, cookies);
      return { user: session.user };
    });

    app.post('/refresh', async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) throw new UnauthorizedError('No refresh token');
      const session = await auth.refresh(token);
      setSessionCookies(reply, session, cookies);
      return { user: session.user };
    });

    app.post('/logout', async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) await auth.logout(token);
      clearSessionCookies(reply, cookies);
      return reply.code(204).send();
    });

    app.get(
      '/me',
      { onRequest: hooks.requireAuth },
      async (request) => request.user
    );

    app.post(
      '/logout-everywhere',
      { onRequest: hooks.requireAuth },
      async (request, reply) => {
        await auth.logoutEverywhere(request.user!.id);
        clearSessionCookies(reply, cookies);
        return reply.code(204).send();
      }
    );

    if (!oauthProvider) return;

    /**
     * `state` is generated here, stored in a short-lived cookie, and compared on
     * the way back — that comparison is what stops a CSRF-forged callback.
     */
    app.get(`/oauth/${oauthProvider.name}/start`, async (_request, reply) => {
      const state = randomBytes(16).toString('hex');
      reply.setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: cookies.secure,
        sameSite: 'lax',
        path: '/api/v0/auth',
        maxAge: 600,
      });
      return reply.redirect(oauthProvider.authorizeUrl(state));
    });

    app.get(`/oauth/${oauthProvider.name}/callback`, async (request, reply) => {
      const { code, state } = parse(callbackQuerySchema, request.query);
      const expectedState = request.cookies[OAUTH_STATE_COOKIE];
      if (!expectedState || expectedState !== state) {
        throw new UnauthorizedError('Invalid OAuth state');
      }
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v0/auth' });

      const profile = await oauthProvider.exchange(code);
      const session = await auth.signInWithOauth(
        oauthProvider.name,
        profile,
        options.oauthDefaultRole
      );
      setSessionCookies(reply, session, cookies);
      return reply.redirect(options.oauthSuccessRedirect);
    });
  };
}
