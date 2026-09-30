import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Keyzen } from '../src';

describe('Keyzen Node.js SDK', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should throw error if token is missing', async () => {
    const client = new Keyzen({ token: '' });
    await expect(client.getAll()).rejects.toThrow('Missing service token');
  });

  it('should fetch and cache secrets from endpoint', async () => {
    const mockSecrets = {
      DATABASE_URL: 'postgresql://postgres@localhost:5432/mydb',
      STRIPE_KEY: 'sk_test_placeholder',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        environment: 'prod',
        count: 2,
        secrets: mockSecrets,
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = new Keyzen({
      token: 'kzn_prod_test123',
      endpoint: 'http://localhost:4000',
    });

    const val = await client.get('STRIPE_KEY');
    expect(val).toBe('sk_test_placeholder');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call should hit in-memory cache without extra network request
    const dbUrl = await client.get('DATABASE_URL');
    expect(dbUrl).toBe('postgresql://postgres@localhost:5432/mydb');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should inject secrets into process.env', async () => {
    const mockSecrets = {
      CUSTOM_SECRET_A: 'alpha_value',
      CUSTOM_SECRET_B: 'beta_value',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          environment: 'dev',
          count: 2,
          secrets: mockSecrets,
        }),
      })
    );

    const client = new Keyzen({ token: 'kzn_dev_test' });
    await client.injectEnv();

    expect(process.env.CUSTOM_SECRET_A).toBe('alpha_value');
    expect(process.env.CUSTOM_SECRET_B).toBe('beta_value');
  });
});
