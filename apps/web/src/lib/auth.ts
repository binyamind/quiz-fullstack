import type { Role } from './types.ts';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export function homeForRole(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teach';
  return '/my';
}

export function roleAllowedOnPath(role: Role, pathname: string): boolean {
  if (pathname === '/' || pathname === '/login') return true;
  if (pathname.startsWith('/admin')) return role === 'admin';
  if (pathname.startsWith('/teach')) return role === 'teacher' || role === 'admin';
  if (pathname.startsWith('/my')) return role === 'student';
  return true;
}

export function isPublicPath(pathname: string): boolean {
  return pathname === '/login';
}

type HeaderSource = { get(name: string): string | null };

function firstHeader(value: string | null): string | undefined {
  const part = value?.split(',')[0]?.trim();
  return part || undefined;
}

function usableHost(host: string | undefined): string | undefined {
  if (!host) return undefined;
  if (host === '0.0.0.0' || host.startsWith('0.0.0.0:')) return undefined;
  return host;
}

/** Origin the browser should see, not the container bind address. */
export function publicOrigin(request: {
  url: string;
  headers: HeaderSource;
}): string {
  const host =
    usableHost(firstHeader(request.headers.get('x-forwarded-host'))) ??
    usableHost(firstHeader(request.headers.get('host')));
  const forwardedProto = firstHeader(request.headers.get('x-forwarded-proto'));
  const url = new URL(request.url);
  const proto =
    forwardedProto === 'https' || forwardedProto === 'http'
      ? forwardedProto
      : url.protocol === 'https:'
        ? 'https'
        : 'http';
  if (host) return `${proto}://${host}`;
  return url.origin;
}

export function absoluteUrl(
  request: { url: string; headers: HeaderSource },
  path: string
): URL {
  return new URL(path, publicOrigin(request));
}

/** Reject open redirects: only same-origin relative paths. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  if (value.startsWith('/login')) return '/';
  return value;
}

export interface AccessClaims {
  sub: string;
  role: Role;
  typ?: string;
  exp?: number;
}

const ROLES: Role[] = ['admin', 'teacher', 'student'];

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value);
}

export function decodeJwtPayload(token: string): AccessClaims | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    const payload = JSON.parse(json) as Record<string, unknown>;
    if (typeof payload.sub !== 'string' || !isRole(payload.role)) return null;
    return {
      sub: payload.sub,
      role: payload.role,
      typ: typeof payload.typ === 'string' ? payload.typ : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}

export function isAccessValid(
  claims: AccessClaims | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): claims is AccessClaims {
  if (!claims) return false;
  if (claims.typ && claims.typ !== 'access') return false;
  if (claims.exp !== undefined && claims.exp <= nowSeconds) return false;
  return true;
}

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  if (typeof atob === 'function') {
    return atob(padded + pad);
  }
  return Buffer.from(padded + pad, 'base64').toString('utf8');
}
