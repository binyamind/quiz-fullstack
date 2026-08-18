import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createPool } from './db.ts';
import { migrate, resetSchema } from './migrate.ts';

/**
 * The runner creates `_migrations` and applies DDL, and `resetSchema` drops the
 * public schema outright — both far too destructive for the shared integration
 * database, so this file works in a scratch database of its own.
 */
const BASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/concentrate-quiz';

const SCRATCH_DB = 'concentrate_quiz_migrate_test';
const scratchUrl = new URL(BASE_URL);
scratchUrl.pathname = `/${SCRATCH_DB}`;

let admin: Pool;
let pool: Pool;
let dir: string;

beforeAll(async () => {
  admin = new Pool({ connectionString: BASE_URL });
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
  await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
  pool = createPool(scratchUrl.toString());
  dir = await mkdtemp(join(tmpdir(), 'quiz-migrations-'));
});

beforeEach(async () => {
  await resetSchema(pool);
});

afterAll(async () => {
  await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
  await admin.end();
  await rm(dir, { recursive: true, force: true });
});

async function writeMigrations(files: Record<string, string>): Promise<string> {
  const target = await mkdtemp(join(dir, 'set-'));
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(target, name), sql, 'utf8');
  }
  return target;
}

describe('migrate', () => {
  it('applies pending migrations in filename order and records them', async () => {
    const target = await writeMigrations({
      '002_second.sql': 'ALTER TABLE widgets ADD COLUMN label TEXT',
      '001_first.sql': 'CREATE TABLE widgets (id SERIAL PRIMARY KEY)',
    });

    const applied = await migrate(pool, target);

    expect(applied).toEqual(['001_first.sql', '002_second.sql']);
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'widgets'`
    );
    expect(rows.map((r) => r.column_name).sort()).toEqual(['id', 'label']);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const target = await writeMigrations({
      '001_first.sql': 'CREATE TABLE widgets (id SERIAL PRIMARY KEY)',
    });

    await migrate(pool, target);
    await expect(migrate(pool, target)).resolves.toEqual([]);
  });

  it('applies only the files added since the last run', async () => {
    const target = await writeMigrations({
      '001_first.sql': 'CREATE TABLE widgets (id SERIAL PRIMARY KEY)',
    });
    await migrate(pool, target);

    await writeFile(
      join(target, '002_second.sql'),
      'CREATE TABLE gadgets (id SERIAL PRIMARY KEY)',
      'utf8'
    );

    await expect(migrate(pool, target)).resolves.toEqual(['002_second.sql']);
  });

  it('ignores files that are not .sql', async () => {
    const target = await writeMigrations({
      '001_first.sql': 'CREATE TABLE widgets (id SERIAL PRIMARY KEY)',
      'README.md': 'not a migration',
    });

    await expect(migrate(pool, target)).resolves.toEqual(['001_first.sql']);
  });

  it('rolls back a failing migration and names it in the error', async () => {
    const target = await writeMigrations({
      '001_first.sql': 'CREATE TABLE widgets (id SERIAL PRIMARY KEY)',
      '002_broken.sql':
        'CREATE TABLE gadgets (id SERIAL PRIMARY KEY); THIS IS NOT SQL',
    });

    await expect(migrate(pool, target)).rejects.toThrow(
      /Migration 002_broken\.sql failed: /
    );

    // The whole file ran in one transaction, so the valid half is gone too.
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tables = rows.map((r) => r.table_name);
    expect(tables).toContain('widgets');
    expect(tables).not.toContain('gadgets');

    const recorded = await pool.query(
      'SELECT name FROM _migrations WHERE name = $1',
      ['002_broken.sql']
    );
    expect(recorded.rowCount).toBe(0);
  });

  it('keeps the original failure as the error cause', async () => {
    const target = await writeMigrations({
      '001_broken.sql': 'NOT SQL AT ALL',
    });

    const error = await migrate(pool, target).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it('applies the real migrations when no directory is given', async () => {
    const applied = await migrate(pool);

    expect(applied.length).toBeGreaterThan(0);
    expect(applied.every((f) => f.endsWith('.sql'))).toBe(true);
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    expect(rows.map((r) => r.table_name)).toContain('users');
  });
});

describe('resetSchema', () => {
  it('drops every table the migrations created', async () => {
    await migrate(pool);

    await resetSchema(pool);

    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    expect(rows).toEqual([]);
  });
});
