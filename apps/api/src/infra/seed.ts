import type { DB } from './db.ts';
import { hashPassword } from '../shared/password.ts';
import type { Role } from './schema.ts';

export interface SeedAccount {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export interface SeedResult {
  created: string[];
  skipped: string[];
}

/**
 * Creates the first accounts for a fresh database. Without this there is no way
 * in: `POST /users` is admin-only, so an empty `users` table can never gain its
 * first admin over HTTP. Idempotent — existing emails are left untouched.
 */
export async function seedAccounts(
  db: DB,
  accounts: SeedAccount[]
): Promise<SeedResult> {
  const result: SeedResult = { created: [], skipped: [] };

  for (const account of accounts) {
    const email = account.email.toLowerCase();
    const existing = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();

    if (existing) {
      result.skipped.push(email);
      continue;
    }

    await db
      .insertInto('users')
      .values({
        email,
        name: account.name,
        role: account.role,
        passwordHash: await hashPassword(account.password),
      })
      .execute();
    result.created.push(email);
  }

  return result;
}

/** A small, coherent school used by the demo and by E2E runs. */
export function demoAccounts(password: string): SeedAccount[] {
  return [
    { email: 'admin@school.test', name: 'Ada Admin', role: 'admin', password },
    {
      email: 'tina@school.test',
      name: 'Tina Teacher',
      role: 'teacher',
      password,
    },
    { email: 'tom@school.test', name: 'Tom Teacher', role: 'teacher', password },
    { email: 'sam@school.test', name: 'Sam Student', role: 'student', password },
    { email: 'sue@school.test', name: 'Sue Student', role: 'student', password },
  ];
}
