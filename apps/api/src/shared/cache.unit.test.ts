import { describe, expect, it, vi } from 'vitest';
import { createFakeRedis } from '../test/fake-redis.ts';
import { createNoopCache, createRedisCache } from './cache.ts';

describe('redis cache', () => {
  it('loads and stores on a miss', async () => {
    const redis = createFakeRedis();
    const cache = createRedisCache(redis);
    const load = vi.fn().mockResolvedValue({ average: 82 });

    await expect(cache.wrap('stats:all', 30, load)).resolves.toEqual({
      average: 82,
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(redis.store.get('stats:all')).toBe(JSON.stringify({ average: 82 }));
  });

  it('serves a hit without calling the loader', async () => {
    const redis = createFakeRedis({ 'stats:all': '{"average":82}' });
    const load = vi.fn();

    await expect(
      createRedisCache(redis).wrap('stats:all', 30, load)
    ).resolves.toEqual({ average: 82 });
    expect(load).not.toHaveBeenCalled();
  });

  it('caches a falsy value rather than treating it as a miss', async () => {
    const redis = createFakeRedis({ 'stats:none': 'null' });
    const load = vi.fn();

    await expect(
      createRedisCache(redis).wrap('stats:none', 30, load)
    ).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('bypasses redis entirely when the ttl is zero or negative', async () => {
    const redis = createFakeRedis();
    const cache = createRedisCache(redis);

    await expect(cache.wrap('k', 0, async () => 'fresh')).resolves.toBe(
      'fresh'
    );
    await expect(cache.wrap('k', -1, async () => 'fresh')).resolves.toBe(
      'fresh'
    );
    expect(redis.store.size).toBe(0);
  });

  it('invalidates every key under a prefix and leaves the rest', async () => {
    const redis = createFakeRedis({
      'stats:a': '1',
      'stats:b': '2',
      'session:x': '3',
    });

    await createRedisCache(redis).invalidate('stats:');

    expect([...redis.store.keys()]).toEqual(['session:x']);
  });

  it('keeps scanning until the cursor comes back to zero', async () => {
    const redis = createFakeRedis({
      'stats:a': '1',
      'stats:b': '2',
      'stats:c': '3',
    });
    redis.scanPageSize = 1;
    const scan = vi.spyOn(redis, 'scan');

    await createRedisCache(redis).invalidate('stats:');

    expect(redis.store.size).toBe(0);
    expect(scan.mock.calls.length).toBeGreaterThan(1);
  });

  it('issues no delete when a scan page is empty', async () => {
    const redis = createFakeRedis({ 'session:x': '1' });
    const del = vi.spyOn(redis, 'del');

    await createRedisCache(redis).invalidate('stats:');

    expect(del).not.toHaveBeenCalled();
    expect(redis.store.size).toBe(1);
  });
});

describe('noop cache', () => {
  it('always calls through to the loader', async () => {
    const cache = createNoopCache();
    const load = vi.fn().mockResolvedValue('value');

    await expect(cache.wrap('k', 30, load)).resolves.toBe('value');
    await expect(cache.wrap('k', 30, load)).resolves.toBe('value');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('has an invalidate that resolves and does nothing', async () => {
    await expect(
      createNoopCache().invalidate('stats:')
    ).resolves.toBeUndefined();
  });
});
