/**
 * Minimal ambient types for `jsonwebtoken`.
 *
 * `@types/jsonwebtoken` is not in the locked dependency list, so this covers the
 * two calls the auth module makes: signing with an expiry, and verifying.
 */
declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [claim: string]: unknown;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    iat?: number;
    jti?: string;
  }

  export interface SignOptions {
    expiresIn?: number | string;
    algorithm?: 'HS256' | 'HS384' | 'HS512';
    notBefore?: number | string;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
  }

  export interface VerifyOptions {
    algorithms?: ('HS256' | 'HS384' | 'HS512')[];
    audience?: string | RegExp | (string | RegExp)[];
    issuer?: string | string[];
    clockTolerance?: number;
    ignoreExpiration?: boolean;
  }

  export class JsonWebTokenError extends Error {}
  export class TokenExpiredError extends JsonWebTokenError {
    expiredAt: Date;
  }
  export class NotBeforeError extends JsonWebTokenError {
    date: Date;
  }

  export function sign(
    payload: string | object | Buffer,
    secret: string | Buffer,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secret: string | Buffer,
    options?: VerifyOptions
  ): JwtPayload | string;

  export function decode(token: string): JwtPayload | string | null;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
    decode: typeof decode;
  };
  export default jwt;
}
