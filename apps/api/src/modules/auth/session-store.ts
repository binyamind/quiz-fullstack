import type { Redis } from 'ioredis';

/**
 * Tracks which refresh-token ids are still live. Access tokens stay stateless
 * (verified by signature alone), but refresh ids are checked here, which is what
 * makes logout and "revoke every session" actually take effect server-side.
 */
export interface SessionStore {
  remember(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  isLive(userId: string, jti: string): Promise<boolean>;
  revoke(userId: string, jti: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
}

const key = (userId: string, jti: string) => `session:${userId}:${jti}`;

export function createRedisSessionStore(redis: Redis): SessionStore {
  return {
    async remember(userId, jti, ttlSeconds) {
      await redis.set(key(userId, jti), '1', 'EX', ttlSeconds);
    },

    async isLive(userId, jti) {
      return (await redis.exists(key(userId, jti))) === 1;
    },

    async revoke(userId, jti) {
      await redis.del(key(userId, jti));
    },

    async revokeAll(userId) {
      // Session counts per user are tiny, so a scan beats maintaining an index.
      const pattern = `session:${userId}:*`;
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    },
  };
}

/** Used by unit tests and by `NODE_ENV=test` runs without a Redis instance. */
export function createMemorySessionStore(): SessionStore {
  const live = new Map<string, number>();
  const alive = (k: string) => {
    const expiry = live.get(k);
    if (expiry === undefined) return false;
    if (expiry <= Date.now()) {
      live.delete(k);
      return false;
    }
    return true;
  };

  return {
    async remember(userId, jti, ttlSeconds) {
      live.set(key(userId, jti), Date.now() + ttlSeconds * 1000);
    },
    async isLive(userId, jti) {
      return alive(key(userId, jti));
    },
    async revoke(userId, jti) {
      live.delete(key(userId, jti));
    },
    async revokeAll(userId) {
      for (const k of [...live.keys()]) {
        if (k.startsWith(`session:${userId}:`)) live.delete(k);
      }
    },
  };
}
