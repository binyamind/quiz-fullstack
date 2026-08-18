import { ForbiddenError, UnauthorizedError } from '../../shared/errors.ts';
import { verifyPassword } from '../../shared/password.ts';
import type { PublicUser, Role } from '../../infra/schema.ts';
import type { AuthRepo } from './auth.repo.ts';
import type { OAuthProfile } from './github.ts';
import type { SessionStore } from './session-store.ts';
import type { Tokens } from './tokens.ts';

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface AuthService {
  login(email: string, password: string): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  logout(refreshToken: string): Promise<void>;
  logoutEverywhere(userId: string): Promise<void>;
  me(userId: string): Promise<PublicUser>;
  /** Verifies an access token and re-checks the user against the database. */
  authenticate(accessToken: string): Promise<PublicUser>;
  signInWithOauth(
    provider: string,
    profile: OAuthProfile,
    defaultRole: Role
  ): Promise<Session>;
}

export function createAuthService(
  repo: AuthRepo,
  tokens: Tokens,
  sessions: SessionStore
): AuthService {
  async function issue(user: PublicUser): Promise<Session> {
    const subject = { sub: user.id, role: user.role };
    const { token: refreshToken, jti } = tokens.signRefresh(subject);
    await sessions.remember(user.id, jti, tokens.refreshTtlSeconds);
    return { user, accessToken: tokens.signAccess(subject), refreshToken };
  }

  function assertActive(user: PublicUser): void {
    if (user.suspended) throw new ForbiddenError('This account is suspended');
  }

  return {
    async login(email, password) {
      const account = await repo.findCredentialsByEmail(email.toLowerCase());

      // Hash a decoy on unknown emails so timing does not reveal which exist.
      const storedHash =
        account?.passwordHash ??
        'scrypt$16384$00000000000000000000000000000000$00';
      const ok = await verifyPassword(password, storedHash);
      if (!account || !account.passwordHash || !ok) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const { passwordHash: _passwordHash, ...user } = account;
      assertActive(user);
      return issue(user);
    },

    async refresh(refreshToken) {
      const claims = tokens.verifyRefresh(refreshToken);
      const live = await sessions.isLive(claims.sub, claims.jti);
      if (!live) throw new UnauthorizedError('Session has been revoked');

      const user = await repo.findUserById(claims.sub);
      if (!user) throw new UnauthorizedError('Session user no longer exists');
      assertActive(user);

      // Rotate: the presented refresh token cannot be replayed.
      await sessions.revoke(claims.sub, claims.jti);
      return issue(user);
    },

    async logout(refreshToken) {
      // A malformed or expired token still ends in a cleared cookie, not a 401.
      try {
        const claims = tokens.verifyRefresh(refreshToken);
        await sessions.revoke(claims.sub, claims.jti);
      } catch {
        return;
      }
    },

    async logoutEverywhere(userId) {
      await sessions.revokeAll(userId);
    },

    async me(userId) {
      const user = await repo.findUserById(userId);
      if (!user) throw new UnauthorizedError('Session user no longer exists');
      return user;
    },

    async authenticate(accessToken) {
      const claims = tokens.verifyAccess(accessToken);
      const user = await repo.findUserById(claims.sub);
      if (!user) throw new UnauthorizedError('Session user no longer exists');
      assertActive(user);
      return user;
    },

    async signInWithOauth(provider, profile, defaultRole) {
      const linked = await repo.findByOauthIdentity(
        provider,
        profile.providerUserId
      );
      if (linked) {
        assertActive(linked);
        return issue(linked);
      }

      // Link to an existing account by email, or provision a new one.
      const existing = await repo.findUserByEmail(profile.email);
      const user =
        existing ??
        (await repo.createOauthUser({
          email: profile.email,
          name: profile.name,
          role: defaultRole,
        }));

      assertActive(user);
      await repo.linkOauthIdentity(provider, profile.providerUserId, user.id);
      return issue(user);
    },
  };
}
