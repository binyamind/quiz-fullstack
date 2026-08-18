import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { UnauthorizedError } from '../../shared/errors.ts';
import type { Role } from '../../infra/schema.ts';

export interface TokenSubject {
  sub: string;
  role: Role;
}

export interface AccessClaims extends TokenSubject {
  typ: 'access';
  iat: number;
  exp: number;
}

export interface RefreshClaims extends TokenSubject {
  typ: 'refresh';
  jti: string;
  iat: number;
  exp: number;
}

export interface TokensConfig {
  secret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export interface Tokens {
  refreshTtlSeconds: number;
  accessTtlSeconds: number;
  signAccess(subject: TokenSubject): string;
  signRefresh(subject: TokenSubject): { token: string; jti: string };
  verifyAccess(token: string): AccessClaims;
  verifyRefresh(token: string): RefreshClaims;
}

/**
 * Hand-rolled JWT handling on `jsonwebtoken` (the spec asks for exactly that).
 * Access tokens are short-lived and stateless; refresh tokens carry a `jti` so
 * the session store can revoke one device without touching the others.
 */
export function createTokens(config: TokensConfig): Tokens {
  function verify(token: string, expected: 'access' | 'refresh'): JwtPayload {
    let payload: JwtPayload | string;
    try {
      payload = jwt.verify(token, config.secret);
    } catch (error) {
      throw new UnauthorizedError((error as Error).message);
    }
    if (typeof payload === 'string' || payload.typ !== expected) {
      throw new UnauthorizedError(`Unexpected token type`);
    }
    return payload;
  }

  return {
    refreshTtlSeconds: config.refreshTtlSeconds,
    accessTtlSeconds: config.accessTtlSeconds,

    signAccess(subject) {
      return jwt.sign({ ...subject, typ: 'access' }, config.secret, {
        expiresIn: config.accessTtlSeconds,
      });
    },

    signRefresh(subject) {
      const jti = randomUUID();
      const token = jwt.sign(
        { ...subject, typ: 'refresh', jti },
        config.secret,
        {
          expiresIn: config.refreshTtlSeconds,
        }
      );
      return { token, jti };
    },

    verifyAccess(token) {
      return verify(token, 'access') as unknown as AccessClaims;
    },

    verifyRefresh(token) {
      return verify(token, 'refresh') as unknown as RefreshClaims;
    },
  };
}
