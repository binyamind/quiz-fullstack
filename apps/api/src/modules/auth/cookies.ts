import type { FastifyReply } from 'fastify';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const OAUTH_STATE_COOKIE = 'oauth_state';

export interface CookieConfig {
  secure: boolean;
  domain?: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

/**
 * Session cookies are httpOnly (JavaScript cannot read them, so an XSS bug
 * cannot exfiltrate the token) and SameSite=Lax (a cross-site form post cannot
 * ride the session, while the OAuth redirect back from GitHub still works).
 */
export function setSessionCookies(
  reply: FastifyReply,
  session: { accessToken: string; refreshToken: string },
  config: CookieConfig
): void {
  const base = {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax' as const,
    path: '/',
    ...(config.domain ? { domain: config.domain } : {}),
  };

  reply.setCookie(ACCESS_COOKIE, session.accessToken, {
    ...base,
    maxAge: config.accessTtlSeconds,
  });
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    // Scoped to the refresh route so it is not sent with every API call.
    path: '/api/v0/auth',
    maxAge: config.refreshTtlSeconds,
  });
}

export function clearSessionCookies(
  reply: FastifyReply,
  config: CookieConfig
): void {
  const base = {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax' as const,
    ...(config.domain ? { domain: config.domain } : {}),
  };
  reply.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v0/auth' });
}
