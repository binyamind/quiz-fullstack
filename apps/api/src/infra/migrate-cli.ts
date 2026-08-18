import { loadEnv } from './env.ts';
import { createPool } from './db.ts';
import { migrate } from './migrate.ts';

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);

try {
  const applied = await migrate(pool);
  console.log(
    applied.length === 0
      ? 'No pending migrations'
      : `Applied: ${applied.join(', ')}`
  );
} finally {
  await pool.end();
}
