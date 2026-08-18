import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply } from 'fastify';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from './cookies.ts';

function fakeReply() {
  const setCookie = vi.fn();
  const clearCookie = vi.fn();
  return {
    reply: { setCookie, clearCookie } as unknown as FastifyReply,
    setCookie,
    clearCookie,
  };
}

const SESSION = { accessToken: 'access-token', refreshToken: 'refresh-token' };
const CONFIG = {
  secure: true,
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
};

describe('setSessionCookies', () => {
  it('scopes the refresh cookie to the auth routes and the access cookie site-wide', () => {
    const { reply, setCookie } = fakeReply();

    setSessionCookies(reply, SESSION, CONFIG);

    expect(setCookie).toHaveBeenCalledWith(
      ACCESS_COOKIE,
      'access-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 900,
      })
    );
    expect(setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'refresh-token',
      expect.objectContaining({ path: '/api/v0/auth', maxAge: 604800 })
    );
  });

  it('omits the domain attribute when none is configured', () => {
    const { reply, setCookie } = fakeReply();

    setSessionCookies(reply, SESSION, CONFIG);

    expect(setCookie.mock.calls[0][2]).not.toHaveProperty('domain');
  });

  it('sets the domain attribute when one is configured', () => {
    const { reply, setCookie } = fakeReply();

    setSessionCookies(reply, SESSION, { ...CONFIG, domain: 'portal.test' });

    expect(setCookie.mock.calls[0][2]).toMatchObject({ domain: 'portal.test' });
    expect(setCookie.mock.calls[1][2]).toMatchObject({ domain: 'portal.test' });
  });
});

describe('clearSessionCookies', () => {
  it('clears both cookies on the paths they were set with', () => {
    const { reply, clearCookie } = fakeReply();

    clearSessionCookies(reply, CONFIG);

    expect(clearCookie).toHaveBeenCalledWith(
      ACCESS_COOKIE,
      expect.objectContaining({ path: '/' })
    );
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      expect.objectContaining({ path: '/api/v0/auth' })
    );
  });

  it('omits the domain attribute when none is configured', () => {
    const { reply, clearCookie } = fakeReply();

    clearSessionCookies(reply, CONFIG);

    expect(clearCookie.mock.calls[0][1]).not.toHaveProperty('domain');
  });

  it('clears against the configured domain when one is set', () => {
    const { reply, clearCookie } = fakeReply();

    clearSessionCookies(reply, { ...CONFIG, domain: 'portal.test' });

    expect(clearCookie.mock.calls[0][1]).toMatchObject({
      domain: 'portal.test',
    });
    expect(clearCookie.mock.calls[1][1]).toMatchObject({
      domain: 'portal.test',
    });
  });
});
