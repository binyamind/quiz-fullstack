import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// promisify loses scrypt's overload that accepts an options object, so the
// resolved signature is restated here.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number }
) => Promise<Buffer>;

const COST = 16384; // scrypt N
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Password hashing built on `node:crypto` — bcrypt and argon2 are not in the
 * locked dependency list. The stored format `scrypt$N$salt$digest` carries its
 * own parameters so the cost can be raised later without breaking old hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const digest = await scryptAsync(password, salt, KEY_BYTES, { N: COST });
  return `scrypt$${COST}$${salt.toString('hex')}$${digest.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, cost, saltHex, digestHex] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !saltHex || !digestHex) return false;

  const N = Number(cost);
  if (!Number.isInteger(N) || N <= 0) return false;

  const expected = Buffer.from(digestHex, 'hex');
  const actual = await scryptAsync(
    password,
    Buffer.from(saltHex, 'hex'),
    expected.length,
    { N }
  );

  // Lengths are equal by construction, but timingSafeEqual throws if they differ.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
