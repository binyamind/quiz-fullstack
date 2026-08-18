import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createTokens } from './tokens.ts';

const tokens = createTokens({
  secret: 'test-secret-value',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
});

describe('access tokens', () => {
  it('round-trips the user id and role', () => {
    const token = tokens.signAccess({ sub: 'user-1', role: 'teacher' });
    expect(tokens.verifyAccess(token)).toMatchObject({
      sub: 'user-1',
      role: 'teacher',
      typ: 'access',
    });
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign(
      { sub: 'user-1', role: 'admin', typ: 'access' },
      'other-secret'
    );
    expect(() => tokens.verifyAccess(forged)).toThrow();
  });

  it('rejects a refresh token presented as an access token', () => {
    const { token } = tokens.signRefresh({ sub: 'user-1', role: 'admin' });
    expect(() => tokens.verifyAccess(token)).toThrow(/token type/i);
  });

  it('rejects an expired token', () => {
    const shortLived = createTokens({
      secret: 'test-secret-value',
      accessTtlSeconds: -1,
      refreshTtlSeconds: 60,
    });
    const token = shortLived.signAccess({ sub: 'user-1', role: 'student' });
    expect(() => shortLived.verifyAccess(token)).toThrow(/expired/i);
  });

  it('rejects structural garbage', () => {
    expect(() => tokens.verifyAccess('not.a.jwt')).toThrow();
  });
});

describe('refresh tokens', () => {
  it('issues a unique jti per token so sessions can be revoked individually', () => {
    const a = tokens.signRefresh({ sub: 'user-1', role: 'student' });
    const b = tokens.signRefresh({ sub: 'user-1', role: 'student' });

    expect(a.jti).not.toBe(b.jti);
    expect(tokens.verifyRefresh(a.token).jti).toBe(a.jti);
  });

  it('reports its own lifetime so the session store can match the TTL', () => {
    expect(tokens.refreshTtlSeconds).toBe(604800);
  });

  it('rejects an access token presented as a refresh token', () => {
    const token = tokens.signAccess({ sub: 'user-1', role: 'admin' });
    expect(() => tokens.verifyRefresh(token)).toThrow(/token type/i);
  });
});
