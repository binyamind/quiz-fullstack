import type { Role } from '@/lib/types.ts';

export function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
    'base64url'
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

export function fakeAccess(role: Role, expOffset = 3600): string {
  return fakeJwt({
    sub: 'user-1',
    role,
    typ: 'access',
    exp: Math.floor(Date.now() / 1000) + expOffset,
  });
}
