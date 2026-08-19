import { describe, expect, it } from 'vitest';
import { parseSetCookieHeader, parseSetCookieHeaders } from './cookies.ts';

describe('parseSetCookieHeader', () => {
  it('parses attributes and rejects junk', () => {
    expect(parseSetCookieHeader('')).toBeNull();
    expect(parseSetCookieHeader('=value')).toBeNull();
    const parsed = parseSetCookieHeader(
      'access_token=abc; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax'
    );
    expect(parsed).toEqual({
      name: 'access_token',
      value: 'abc',
      maxAge: 900,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(parseSetCookieHeader('x=y; SameSite=Strict')).toMatchObject({
      sameSite: 'strict',
    });
    expect(parseSetCookieHeader('x=y; SameSite=None')).toMatchObject({
      sameSite: 'none',
    });
    expect(parseSetCookieHeader('x=y; SameSite=weird')).toEqual({
      name: 'x',
      value: 'y',
    });
    expect(parseSetCookieHeader('x=y; ; Path=/')).toEqual({
      name: 'x',
      value: 'y',
      path: '/',
    });
    expect(parseSetCookieHeader('x=y; Max-Age=nope; Path=')).toEqual({
      name: 'x',
      value: 'y',
      path: '/',
    });
  });
});

describe('parseSetCookieHeaders', () => {
  it('skips invalid headers', () => {
    expect(parseSetCookieHeaders(['', 'ok=1'])).toEqual([
      { name: 'ok', value: '1' },
    ]);
  });
});
