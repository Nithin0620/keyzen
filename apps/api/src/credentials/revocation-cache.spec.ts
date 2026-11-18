import { describe, expect, it, vi } from 'vitest';
import { InMemoryRevocationCache, RedisRevocationCache } from './revocation-cache';

describe('RevocationCache', () => {
  it('stores revocations in Redis with an expiry', async () => {
    const redis = { get: vi.fn(async () => '1'), set: vi.fn(async () => 'OK') };
    const cache = new RedisRevocationCache(redis as any);

    await cache.revoke('hash', 90);

    expect(redis.set).toHaveBeenCalledWith('aegis:revoked:hash', '1', 'EX', 90);
    expect(await cache.isRevoked('hash')).toBe(true);
    expect(redis.get).toHaveBeenCalledWith('aegis:revoked:hash');
  });

  it('keeps revocations in memory for non-production runtimes', async () => {
    const cache = new InMemoryRevocationCache();
    expect(await cache.isRevoked('hash')).toBe(false);
    await cache.revoke('hash', 60);
    expect(await cache.isRevoked('hash')).toBe(true);
  });
});
