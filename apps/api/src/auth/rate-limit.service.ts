import { HttpException, HttpStatus } from '../common/http-error';

const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitAbuseSink {
  record(key: string): void;
}

export interface RateLimitResult {
  resetAt: number;
  remaining: number;
}

export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly abuse?: RateLimitAbuseSink) {}

  check(key: string, limit: number, windowMs: number): void {
    this.checkWithReset(key, limit, windowMs);
  }

  checkWithReset(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    if (this.buckets.size > 1000) {
      for (const [name, bucket] of this.buckets) {
        if (bucket.resetAt <= now) {
          this.buckets.delete(name);
        }
      }
    }
    if (this.buckets.size >= MAX_BUCKETS) {
      const oldest = this.buckets.keys().next();
      if (!oldest.done) {
        this.buckets.delete(oldest.value);
      }
    }

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { resetAt, remaining: limit - 1 };
    }
    if (bucket.count >= limit) {
      this.abuse?.record(key);
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    bucket.count += 1;
    return { resetAt: bucket.resetAt, remaining: Math.max(0, limit - bucket.count) };
  }
}
