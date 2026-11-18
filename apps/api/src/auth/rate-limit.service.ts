import { HttpException, HttpStatus } from '../common/http-error';

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  check(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    if (this.buckets.size > 1000) {
      for (const [name, bucket] of this.buckets) {
        if (bucket.resetAt <= now) {
          this.buckets.delete(name);
        }
      }
    }

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (bucket.count >= limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    bucket.count += 1;
  }
}
