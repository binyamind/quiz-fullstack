import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://postgres:postgres@localhost:5432/concentrate-quiz'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // Auth. JWT_SECRET has no default on purpose: a shipped default secret is a
  // forgeable session, so the server refuses to start without one.
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),

  // GitHub OAuth. Absent values simply disable the provider's routes.
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z
    .string()
    .default('http://localhost:4000/api/v0/auth/oauth/github/callback'),
  OAUTH_SUCCESS_REDIRECT: z.string().default('http://localhost:3000'),

  // Seeding (see `npm run seed`).
  SEED_ADMIN_EMAIL: z.string().email().default('admin@school.test'),
  SEED_PASSWORD: z.string().min(8).default('password-1234'),

  // Stats cache. 0 disables caching entirely.
  STATS_CACHE_TTL: z.coerce.number().int().min(0).default(30),

  // Chatbot (extra credit). Without a key the chat route returns 503.
  ANTHROPIC_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().default('claude-opus-5'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
