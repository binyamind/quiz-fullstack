import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  truncateAll,
  type TestContext,
} from '../test/harness.ts';
import { verifyPassword } from '../shared/password.ts';
import { demoAccounts, seedAccounts } from './seed.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll(ctx.pool);
});

afterAll(async () => {
  await ctx.close();
});

describe('seedAccounts', () => {
  it('creates the accounts it is given', async () => {
    const result = await seedAccounts(ctx.db, [
      {
        email: 'first-admin@school.test',
        name: 'Ada Admin',
        role: 'admin',
        password: 'seed-password-1',
      },
    ]);

    expect(result).toEqual({
      created: ['first-admin@school.test'],
      skipped: [],
    });

    const user = await ctx.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', 'first-admin@school.test')
      .executeTakeFirstOrThrow();
    expect(user.role).toBe('admin');
    expect(user.name).toBe('Ada Admin');
    await expect(
      verifyPassword('seed-password-1', user.passwordHash)
    ).resolves.toBe(true);
  });

  it('lowercases the email so a re-seed cannot create a duplicate', async () => {
    await seedAccounts(ctx.db, [
      {
        email: 'MiXeD@school.test',
        name: 'Mixed',
        role: 'admin',
        password: 'pw-123456',
      },
    ]);

    const result = await seedAccounts(ctx.db, [
      {
        email: 'mixed@school.test',
        name: 'Mixed',
        role: 'admin',
        password: 'pw-123456',
      },
    ]);

    expect(result.skipped).toEqual(['mixed@school.test']);
    const count = await ctx.db
      .selectFrom('users')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(1);
  });

  it('is idempotent, reporting existing accounts as skipped', async () => {
    const accounts = demoAccounts('demo-password-1');
    const first = await seedAccounts(ctx.db, accounts);
    const second = await seedAccounts(ctx.db, accounts);

    expect(first.created).toHaveLength(accounts.length);
    expect(first.skipped).toEqual([]);
    expect(second.created).toEqual([]);
    expect(second.skipped).toHaveLength(accounts.length);
  });

  it('creates the new accounts in a partially seeded database', async () => {
    await seedAccounts(ctx.db, [
      {
        email: 'admin@school.test',
        name: 'Ada',
        role: 'admin',
        password: 'pw-123456',
      },
    ]);

    const result = await seedAccounts(ctx.db, [
      {
        email: 'admin@school.test',
        name: 'Ada',
        role: 'admin',
        password: 'pw-123456',
      },
      {
        email: 'new@school.test',
        name: 'New',
        role: 'teacher',
        password: 'pw-123456',
      },
    ]);

    expect(result).toEqual({
      created: ['new@school.test'],
      skipped: ['admin@school.test'],
    });
  });

  it('accepts an empty list', async () => {
    await expect(seedAccounts(ctx.db, [])).resolves.toEqual({
      created: [],
      skipped: [],
    });
  });
});

describe('demoAccounts', () => {
  it('covers all three roles and shares the given password', () => {
    const accounts = demoAccounts('shared-password');

    expect(accounts.map((a) => a.role).sort()).toEqual([
      'admin',
      'student',
      'student',
      'teacher',
      'teacher',
    ]);
    expect(accounts.every((a) => a.password === 'shared-password')).toBe(true);
    expect(new Set(accounts.map((a) => a.email)).size).toBe(accounts.length);
  });
});
