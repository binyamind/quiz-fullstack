import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { apiFetch } from './api.ts';
import { ACCESS_COOKIE } from './auth.ts';
import { parseSetCookieHeaders } from './cookies.ts';
import { ApiError } from './errors.ts';
import type { PublicUser } from './types.ts';

export const getSession = cache(async (): Promise<PublicUser | null> => {
  const store = await cookies();
  if (!store.get(ACCESS_COOKIE)?.value) return null;
  try {
    return await apiFetch<PublicUser>('/auth/me', { skipMap: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

export async function requireSession(): Promise<PublicUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}

export async function applySetCookies(response: Response): Promise<void> {
  const store = await cookies();
  const headers =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
  for (const cookie of parseSetCookieHeaders(headers)) {
    store.set({
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    });
  }
}
