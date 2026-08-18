import { Redis } from 'ioredis';
import { buildApp } from './app.ts';
import { createDb, createPool } from './infra/db.ts';
import { loadEnv } from './infra/env.ts';
import { migrate } from './infra/migrate.ts';

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const db = createDb(pool);
const redis = new Redis(env.REDIS_URL);

await migrate(pool);

const github =
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: env.GITHUB_REDIRECT_URI,
      }
    : undefined;

const app = await buildApp({
  db,
  redis,
  logger: { level: env.LOG_LEVEL },
  corsOrigin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  auth: {
    jwtSecret: env.JWT_SECRET,
    accessTtlSeconds: env.ACCESS_TOKEN_TTL,
    refreshTtlSeconds: env.REFRESH_TOKEN_TTL,
    cookieSecure: env.COOKIE_SECURE,
    cookieDomain: env.COOKIE_DOMAIN,
    oauthSuccessRedirect: env.OAUTH_SUCCESS_REDIRECT,
    github,
  },
  statsCacheTtlSeconds: env.STATS_CACHE_TTL,
  chat: env.ANTHROPIC_API_KEY
    ? { apiKey: env.ANTHROPIC_API_KEY, model: env.CHAT_MODEL }
    : undefined,
});

if (!env.ANTHROPIC_API_KEY) {
  app.log.warn('Chatbot is disabled: set ANTHROPIC_API_KEY to enable /chat');
}

if (!github) {
  app.log.warn('GitHub OAuth is disabled: set GITHUB_CLIENT_ID and _SECRET');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => db.destroy())
      .then(() => redis.quit())
      .then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: env.HOST });
