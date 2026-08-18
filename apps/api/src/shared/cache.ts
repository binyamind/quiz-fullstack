import type { Redis } from 'ioredis';

/**
 * A tiny read-through cache over Redis. Stats queries aggregate across the whole
 * school on every call, so they are the one place caching earns its keep.
 */
export interface Cache {
  wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T>;
  invalidate(prefix: string): Promise<void>;
}

export function createRedisCache(redis: Redis): Cache {
  return {
    async wrap(key, ttlSeconds, load) {
      if (ttlSeconds <= 0) return load();

      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit);

      const value = await load();
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return value;
    },

    async invalidate(prefix) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          200
        );
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    },
  };
}

/** Cache-free implementation for tests and for `STATS_CACHE_TTL=0`. */
export function createNoopCache(): Cache {
  return {
    async wrap(_key, _ttl, load) {
      return load();
    },
    async invalidate() {},
  };
}
