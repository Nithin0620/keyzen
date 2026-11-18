import type Redis from 'ioredis';

export interface RevocationCache {
  isRevoked(tokenHash: string): Promise<boolean>;
  revoke(tokenHash: string, ttlSeconds: number): Promise<void>;
}

export class RedisRevocationCache implements RevocationCache {
  constructor(private readonly redis: Redis, private readonly prefix = 'aegis:revoked:') {}

  async isRevoked(tokenHash: string): Promise<boolean> {
    const value = await this.redis.get(`${this.prefix}${tokenHash}`);
    return value === '1';
  }

  async revoke(tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${this.prefix}${tokenHash}`, '1', 'EX', Math.max(1, Math.ceil(ttlSeconds)));
  }
}

export class InMemoryRevocationCache implements RevocationCache {
  private readonly entries = new Map<string, number>();

  async isRevoked(tokenHash: string): Promise<boolean> {
    const expiresAt = this.entries.get(tokenHash);
    if (!expiresAt) {
      return false;
    }
    if (expiresAt <= Date.now()) {
      this.entries.delete(tokenHash);
      return false;
    }
    return true;
  }

  async revoke(tokenHash: string, ttlSeconds: number): Promise<void> {
    this.entries.set(tokenHash, Date.now() + Math.max(1, ttlSeconds) * 1000);
  }
}
