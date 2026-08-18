import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../../shared/errors.ts';
import type { AuthRepo } from './auth.repo.ts';
import { createAuthService } from './auth.service.ts';
import { createMemorySessionStore } from './session-store.ts';
import { createTokens } from './tokens.ts';

const tokens = createTokens({
  secret: 'unit-test-secret-at-least-32-characters',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
});

const USER = {
  id: 'user-1',
  email: 'someone@school.test',
  name: 'Someone',
  role: 'student' as const,
  suspended: false,
};

function build(repoOverrides: Partial<AuthRepo> = {}) {
  const sessions = createMemorySessionStore();
  const repo = {
    async findUserById() {
      return USER;
    },
    ...repoOverrides,
  } as unknown as AuthRepo;
  return { service: createAuthService(repo, tokens, sessions), sessions };
}

describe('logout', () => {
  it('revokes the session the refresh token names', async () => {
    const { service, sessions } = build();
    const { token, jti } = tokens.signRefresh({
      sub: 'user-1',
      role: 'student',
    });
    await sessions.remember('user-1', jti, 60);

    await service.logout(token);

    await expect(sessions.isLive('user-1', jti)).resolves.toBe(false);
  });

  it('swallows a malformed token — logout still clears the cookie', async () => {
    const { service } = build();

    await expect(service.logout('not-a-jwt')).resolves.toBeUndefined();
  });

  it('swallows an access token presented in place of a refresh token', async () => {
    const { service } = build();
    const access = tokens.signAccess({ sub: 'user-1', role: 'student' });

    await expect(service.logout(access)).resolves.toBeUndefined();
  });
});

describe('logoutEverywhere', () => {
  it('revokes every live session for the user', async () => {
    const { service, sessions } = build();
    await sessions.remember('user-1', 'jti-1', 60);
    await sessions.remember('user-1', 'jti-2', 60);

    await service.logoutEverywhere('user-1');

    await expect(sessions.isLive('user-1', 'jti-1')).resolves.toBe(false);
    await expect(sessions.isLive('user-1', 'jti-2')).resolves.toBe(false);
  });
});

describe('me', () => {
  it('returns the current user record', async () => {
    const { service } = build();

    await expect(service.me('user-1')).resolves.toEqual(USER);
  });

  it('rejects a session whose user has since been deleted', async () => {
    const { service } = build({ findUserById: vi.fn(async () => undefined) });

    await expect(service.me('user-1')).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    await expect(service.me('user-1')).rejects.toThrow(
      'Session user no longer exists'
    );
  });
});

describe('a user deleted while their tokens are still valid', () => {
  it('refuses to refresh a session whose user is gone', async () => {
    const { service, sessions } = build({
      findUserById: vi.fn(async () => undefined),
    });
    const { token, jti } = tokens.signRefresh({
      sub: 'user-1',
      role: 'student',
    });
    await sessions.remember('user-1', jti, 60);

    await expect(service.refresh(token)).rejects.toThrow(
      'Session user no longer exists'
    );
  });

  it('refuses to authenticate an access token whose user is gone', async () => {
    const { service } = build({ findUserById: vi.fn(async () => undefined) });
    const access = tokens.signAccess({ sub: 'user-1', role: 'student' });

    await expect(service.authenticate(access)).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });
});
