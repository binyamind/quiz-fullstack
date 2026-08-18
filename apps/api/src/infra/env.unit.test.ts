import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.ts';

const MINIMAL = { JWT_SECRET: 'a'.repeat(32) };

describe('loadEnv', () => {
  it('fills in every default around a minimal environment', () => {
    const env = loadEnv(MINIMAL);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      HOST: '0.0.0.0',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGIN: 'http://localhost:3000',
      LOG_LEVEL: 'info',
      ACCESS_TOKEN_TTL: 900,
      REFRESH_TOKEN_TTL: 604800,
      COOKIE_SECURE: false,
      SEED_ADMIN_EMAIL: 'admin@school.test',
      SEED_PASSWORD: 'password-1234',
      STATS_CACHE_TTL: 30,
      CHAT_MODEL: 'claude-opus-5',
    });
    expect(env.DATABASE_URL).toContain('concentrate-quiz');
    expect(env.GITHUB_REDIRECT_URI).toContain('/oauth/github/callback');
    expect(env.OAUTH_SUCCESS_REDIRECT).toBe('http://localhost:3000');
    expect(env.COOKIE_DOMAIN).toBeUndefined();
    expect(env.GITHUB_CLIENT_ID).toBeUndefined();
    expect(env.GITHUB_CLIENT_SECRET).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('coerces numeric strings and the COOKIE_SECURE flag', () => {
    const env = loadEnv({
      ...MINIMAL,
      PORT: '8080',
      ACCESS_TOKEN_TTL: '60',
      REFRESH_TOKEN_TTL: '120',
      STATS_CACHE_TTL: '0',
      COOKIE_SECURE: 'true',
    });

    expect(env.PORT).toBe(8080);
    expect(env.ACCESS_TOKEN_TTL).toBe(60);
    expect(env.REFRESH_TOKEN_TTL).toBe(120);
    expect(env.STATS_CACHE_TTL).toBe(0);
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('keeps the explicitly supplied optional values', () => {
    const env = loadEnv({
      ...MINIMAL,
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      COOKIE_DOMAIN: 'example.test',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      ANTHROPIC_API_KEY: 'sk-test',
      CHAT_MODEL: 'claude-sonnet-5',
      COOKIE_SECURE: 'false',
    });

    expect(env).toMatchObject({
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      COOKIE_DOMAIN: 'example.test',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      ANTHROPIC_API_KEY: 'sk-test',
      CHAT_MODEL: 'claude-sonnet-5',
      COOKIE_SECURE: false,
    });
  });

  it('refuses to start without a JWT_SECRET', () => {
    expect(() => loadEnv({})).toThrow(/JWT_SECRET: Required/);
  });

  it('refuses a JWT_SECRET that is too short to be safe', () => {
    expect(() => loadEnv({ JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET: must be at least 32 characters/
    );
  });

  it('reports every invalid variable in one message', () => {
    const error = (() => {
      try {
        loadEnv({ ...MINIMAL, PORT: '-1', NODE_ENV: 'staging' });
      } catch (e) {
        return e as Error;
      }
    })();

    expect(error?.message).toMatch(/^Invalid environment: /);
    expect(error?.message).toContain('PORT');
    expect(error?.message).toContain('NODE_ENV');
  });

  it('defaults to process.env when no source is given', () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'b'.repeat(32);
    try {
      expect(loadEnv().JWT_SECRET).toBe('b'.repeat(32));
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });
});
