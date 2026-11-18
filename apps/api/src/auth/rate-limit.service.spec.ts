import { describe, expect, it, vi } from 'vitest';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('returns reset times and reports abuse when the limit is exceeded', () => {
    const abuse = { record: vi.fn() };
    const service = new RateLimitService(abuse);
    const now = Date.now();

    const first = service.checkWithReset('ip:203.0.113.10', 2, 60_000);
    expect(first.resetAt).toBeGreaterThanOrEqual(now + 60_000);
    expect(first.remaining).toBe(1);
    const second = service.checkWithReset('ip:203.0.113.10', 2, 60_000);
    expect(second.remaining).toBe(0);
    expect(() => service.checkWithReset('ip:203.0.113.10', 2, 60_000)).toThrowError(/Too many requests/);
    expect(abuse.record).toHaveBeenCalledTimes(1);
    expect(abuse.record).toHaveBeenCalledWith('ip:203.0.113.10');
  });

  it('caps the number of active buckets', () => {
    const service = new RateLimitService();
    for (let index = 0; index < 10_000; index += 1) {
      service.check(`ip:10.0.${Math.floor(index / 256)}.${index % 256}`, 2, 60_000);
    }
    service.check('ip:198.51.100.1', 2, 60_000);

    expect((service as any).buckets.size).toBe(10_000);
  });
});
