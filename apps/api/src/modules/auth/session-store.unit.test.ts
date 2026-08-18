import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeRedis } from '../../test/fake-redis.ts';
import {
  createMemorySessionStore,
  createRedisSessionStore,
} from './session-store.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('redis session store', () => {
  it('remembers a session id and reports it live', async () => {
    const redis = createFakeRedis();
    const store = createRedisSessionStore(redis);

    await store.remember('user-1', 'jti-1', 60);

    expect(redis.store.get('session:user-1:jti-1')).toBe('1');
    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(true);
  });

  it('reports an unknown session id as not live', async () => {
    const store = createRedisSessionStore(createFakeRedis());
    await expect(store.isLive('user-1', 'nope')).resolves.toBe(false);
  });

  it('revokes a single session and leaves the others', async () => {
    const redis = createFakeRedis();
    const store = createRedisSessionStore(redis);
    await store.remember('user-1', 'jti-1', 60);
    await store.remember('user-1', 'jti-2', 60);

    await store.revoke('user-1', 'jti-1');

    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(false);
    await expect(store.isLive('user-1', 'jti-2')).resolves.toBe(true);
  });

  it('revokes every session for one user without touching another', async () => {
    const redis = createFakeRedis();
    const store = createRedisSessionStore(redis);
    await store.remember('user-1', 'jti-1', 60);
    await store.remember('user-1', 'jti-2', 60);
    await store.remember('user-2', 'jti-3', 60);

    await store.revokeAll('user-1');

    expect([...redis.store.keys()]).toEqual(['session:user-2:jti-3']);
  });

  it('pages through the scan cursor when a user has many sessions', async () => {
    const redis = createFakeRedis();
    const store = createRedisSessionStore(redis);
    redis.scanPageSize = 1;
    for (const jti of ['a', 'b', 'c']) await store.remember('user-1', jti, 60);
    const scan = vi.spyOn(redis, 'scan');

    await store.revokeAll('user-1');

    expect(redis.store.size).toBe(0);
    expect(scan.mock.calls.length).toBeGreaterThan(1);
  });

  it('deletes nothing when the user has no sessions', async () => {
    const redis = createFakeRedis();
    const del = vi.spyOn(redis, 'del');

    await createRedisSessionStore(redis).revokeAll('user-1');

    expect(del).not.toHaveBeenCalled();
  });
});

describe('memory session store', () => {
  it('remembers and revokes a session id', async () => {
    const store = createMemorySessionStore();
    await store.remember('user-1', 'jti-1', 60);
    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(true);

    await store.revoke('user-1', 'jti-1');
    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(false);
  });

  it('reports an unknown session id as not live', async () => {
    const store = createMemorySessionStore();
    await expect(store.isLive('user-1', 'nope')).resolves.toBe(false);
  });

  it('expires a session once its ttl elapses', async () => {
    vi.useFakeTimers();
    const store = createMemorySessionStore();
    await store.remember('user-1', 'jti-1', 60);

    vi.advanceTimersByTime(59_000);
    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(true);

    vi.advanceTimersByTime(2_000);
    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(false);
    // The expired entry is dropped, so the second read takes the absent path.
    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(false);
  });

  it('revokes every session for one user without touching another', async () => {
    const store = createMemorySessionStore();
    await store.remember('user-1', 'jti-1', 60);
    await store.remember('user-1', 'jti-2', 60);
    await store.remember('user-2', 'jti-3', 60);

    await store.revokeAll('user-1');

    await expect(store.isLive('user-1', 'jti-1')).resolves.toBe(false);
    await expect(store.isLive('user-1', 'jti-2')).resolves.toBe(false);
    await expect(store.isLive('user-2', 'jti-3')).resolves.toBe(true);
  });
});
