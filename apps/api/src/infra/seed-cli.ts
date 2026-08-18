import { createDb, createPool } from './db.ts';
import { loadEnv } from './env.ts';
import { migrate } from './migrate.ts';
import { demoAccounts, seedAccounts } from './seed.ts';

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const db = createDb(pool);

try {
  await migrate(pool);

  // `--demo` adds the sample school; the default seeds only the first admin.
  const demo = process.argv.includes('--demo');
  const accounts = demo
    ? demoAccounts(env.SEED_PASSWORD)
    : [
        {
          email: env.SEED_ADMIN_EMAIL,
          name: 'Bootstrap Admin',
          role: 'admin' as const,
          password: env.SEED_PASSWORD,
        },
      ];

  const { created, skipped } = await seedAccounts(db, accounts);
  console.log(`created: ${created.join(', ') || '(none)'}`);
  console.log(`already present: ${skipped.join(', ') || '(none)'}`);
  if (created.length > 0) {
    console.log(`password for new accounts: ${env.SEED_PASSWORD}`);
  }
} finally {
  await db.destroy();
}
