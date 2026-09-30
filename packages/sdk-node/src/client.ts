import { KeyzenOptions, ResolveResponse } from './types';

export class Keyzen {
  private token: string;
  private endpoint: string;
  private cacheTtlMs: number;
  private cache: Record<string, string> | null = null;
  private cacheExpiresAt: number = 0;

  constructor(options: KeyzenOptions = {}) {
    this.token = options.token || process.env.KEYZEN_TOKEN || '';
    this.endpoint = (options.endpoint || process.env.KEYZEN_ENDPOINT || 'http://localhost:4000').replace(/\/+$/, '');
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Fetches all decrypted secrets for the configured service token environment.
   */
  async getAll(forceRefresh = false): Promise<Record<string, string>> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    if (!this.token) {
      throw new Error('Keyzen Error: Missing service token. Pass { token } or set KEYZEN_TOKEN environment variable.');
    }

    const res = await fetch(`${this.endpoint}/api/v1/secrets/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`Keyzen Error (${res.status}): ${errorBody.message || res.statusText}`);
    }

    const data = (await res.json()) as ResolveResponse;
    this.cache = data.secrets || {};
    this.cacheExpiresAt = now + this.cacheTtlMs;

    return this.cache;
  }

  /**
   * Fetches a single secret value by name.
   */
  async get(secretName: string): Promise<string | undefined> {
    const all = await this.getAll();
    return all[secretName];
  }

  /**
   * Injects all retrieved secrets directly into `process.env` (Node.js runtime).
   */
  async injectEnv(overwrite = false): Promise<void> {
    const secrets = await this.getAll();
    for (const [key, value] of Object.entries(secrets)) {
      if (overwrite || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  /**
   * Clears in-memory secret cache.
   */
  clearCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }
}

/**
 * Singleton convenience export
 */
export const keyzen = new Keyzen();
