import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.ts';

describe('password hashing', () => {
  it('produces a self-describing scrypt string', async () => {
    const hash = await hashPassword('correct horse battery staple');
    const [scheme, cost, salt, digest] = hash.split('$');

    expect(scheme).toBe('scrypt');
    expect(Number(cost)).toBeGreaterThan(0);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(digest).toMatch(/^[0-9a-f]{128}$/);
  });

  it('salts each hash, so equal passwords hash differently', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);

    expect(a).not.toBe(b);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('s3cret-pass');
    await expect(verifyPassword('s3cret-pass', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-pass');
    await expect(verifyPassword('wrong-pass', hash)).resolves.toBe(false);
  });

  it('rejects a hash whose cost is not a positive integer', async () => {
    await expect(verifyPassword('any', 'scrypt$abc$00ff$00ff')).resolves.toBe(
      false
    );
    await expect(verifyPassword('any', 'scrypt$0$00ff$00ff')).resolves.toBe(
      false
    );
    await expect(
      verifyPassword('any', 'scrypt$-16384$00ff$00ff')
    ).resolves.toBe(false);
    await expect(verifyPassword('any', 'scrypt$1.5$00ff$00ff')).resolves.toBe(
      false
    );
  });

  it('rejects a malformed hash instead of throwing', async () => {
    await expect(verifyPassword('any', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('any', 'scrypt$16384$xy')).resolves.toBe(false);
  });

  it('rejects a digest of a different length without throwing', async () => {
    await expect(verifyPassword('any', 'scrypt$16384$abcd$00ff')).resolves.toBe(
      false
    );
  });
});
