import type { Redis } from 'ioredis';

/**
 * Just enough of ioredis for the cache and session store: get/set/exists/del and
 * a cursor-based `scan`. Real Redis is not in the test path — the integration
 * suite runs against the in-memory session store — so the Redis-backed branches
 * are exercised here instead.
 */
export interface FakeRedis extends Redis {
  store: Map<string, string>;
  /** Forces `scan` to return one key per call, so callers must loop. */
  scanPageSize: number;
}

export function createFakeRedis(
  initial: Record<string, string> = {}
): FakeRedis {
  const store = new Map<string, string>(Object.entries(initial));
  const snapshots = new Map<string, string[]>();
  let cursorSeq = 0;

  const fake = {
    store,
    scanPageSize: 100,

    async get(key: string) {
      return store.get(key) ?? null;
    },

    async set(key: string, value: string) {
      store.set(key, value);
      return 'OK';
    },

    async exists(key: string) {
      return store.has(key) ? 1 : 0;
    },

    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) if (store.delete(key)) removed += 1;
      return removed;
    },

    async ping() {
      return 'PONG';
    },

    /**
     * Cursors index into a snapshot taken when the scan started, because callers
     * delete keys mid-scan and a live index would skip the shifted-down entries.
     */
    async scan(cursor: string, _match: string, pattern: string) {
      const prefix = pattern.replace(/\*$/, '');
      const pending =
        cursor === '0'
          ? [...store.keys()].filter((k) => k.startsWith(prefix))
          : (snapshots.get(cursor) ?? []);
      snapshots.delete(cursor);

      const page = pending.slice(0, fake.scanPageSize);
      const rest = pending.slice(fake.scanPageSize);
      if (rest.length === 0) return ['0', page];

      const next = String(++cursorSeq);
      snapshots.set(next, rest);
      return [next, page];
    },
  } as unknown as FakeRedis;

  return fake;
}
