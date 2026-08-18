import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations'
);

/**
 * A deliberately small forward-only migration runner: Kysely ships no CLI and
 * the dependency list is locked, so each `NNN_name.sql` file is applied once
 * inside a transaction and recorded in `_migrations`.
 */
export async function migrate(
  pool: Pool,
  dir: string = MIGRATIONS_DIR
): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM _migrations'
  );
  const applied = new Set(rows.map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));

  for (const file of pending) {
    const sql = await readFile(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, {
        cause: error,
      });
    } finally {
      client.release();
    }
  }

  return pending;
}

/** Drops every table the migrations own. Used by the integration test harness. */
export async function resetSchema(pool: Pool): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
}
