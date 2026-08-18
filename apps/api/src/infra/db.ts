import { Kysely, PostgresDialect, CamelCasePlugin } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './schema.ts';

export type DB = Kysely<Database>;

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}

/**
 * The CamelCasePlugin lets queries and results use camelCase while the physical
 * schema stays snake_case, so nothing above this file deals in `created_at`.
 */
export function createDb(pool: Pool): DB {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
}
