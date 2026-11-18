import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Aegis,
  type AegisOptions,
  AegisAuthenticationError,
  AegisConfigError,
  AegisRateLimitError,
  AegisResponseError,
} from './index';

const originalToken = process.env.AEGIS_SERVICE_TOKEN;
const originalEndpoint = process.env.AEGIS_API_URL;
const originalSecret = process.env.APP_SECRET;
const originalRunSecret = process.env.RUN_SECRET;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function validationResponse(): Response {
  return jsonResponse({
    valid: true,
    workspaceId: 'workspace',
    projectId: 'project',
    environmentId: 'environment',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });
}

function secretsResponse(): Response {
  return jsonResponse({ entries: [{ name: 'APP_SECRET', value: 'test-value' }] });
}

function createClient(overrides: Partial<AegisOptions> = {}): Aegis {
  return new Aegis({
    projectId: 'project',
    environment: 'environment',
    endpoint: 'https://aegis.test',
    retries: 0,
    ...overrides,
  });
}

describe('Aegis SDK', () => {
  beforeEach(() => {
    process.env.AEGIS_SERVICE_TOKEN = 'ags_test_token';
    delete process.env.AEGIS_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();

    if (originalToken === undefined) {
      delete process.env.AEGIS_SERVICE_TOKEN;
    } else {
      process.env.AEGIS_SERVICE_TOKEN = originalToken;
    }
    if (originalEndpoint === undefined) {
      delete process.env.AEGIS_API_URL;
    } else {
      process.env.AEGIS_API_URL = originalEndpoint;
    }
    if (originalSecret === undefined) {
      delete process.env.APP_SECRET;
    } else {
      process.env.APP_SECRET = originalSecret;
    }
    if (originalRunSecret === undefined) {
      delete process.env.RUN_SECRET;
    } else {
      process.env.RUN_SECRET = originalRunSecret;
    }
  });

  it('validates, syncs and injects secrets into process.env', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(validationResponse())
      .mockResolvedValueOnce(secretsResponse())
      .mockResolvedValueOnce(secretsResponse());
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.APP_SECRET;

    const client = createClient();
    await client.init();
    expect(client.get('APP_SECRET')).toBe('test-value');
    await client.inject();

    expect(process.env.APP_SECRET).toBe('test-value');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const validationInit = fetchMock.mock.calls[0][1] as RequestInit;
    const resolveInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(validationInit.method).toBe('GET');
    expect(resolveInit.method).toBe('POST');
    expect(validationInit.headers).toMatchObject({ authorization: 'Bearer ags_test_token' });
  });

  it('expires cache entries by TTL and clears them on disconnect', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => secretsResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient({ cacheTtlMs: 5 });

    await client.sync();
    expect(client.get('APP_SECRET')).toBe('test-value');
    expect(Object.isFrozen(client.getAll())).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(client.get('APP_SECRET')).toBeUndefined();
    expect(client.getAll()).toEqual({});

    await client.sync();
    client.disconnect();
    expect(client.getAll()).toEqual({});
  });

  it('requires a token without making a request', async () => {
    delete process.env.AEGIS_SERVICE_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient();

    await expect(client.validate()).rejects.toBeInstanceOf(AegisConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not retry rejected service tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient({ retries: 3 });

    await expect(client.sync()).rejects.toBeInstanceOf(AegisAuthenticationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries rate-limited requests within the configured bound', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(secretsResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient({ retries: 1 });

    await client.sync();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.get('APP_SECRET')).toBe('test-value');
  });

  it('stops after retries are exhausted on rate limiting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient({ retries: 1 });

    await expect(client.sync()).rejects.toBeInstanceOf(AegisRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects unsafe secret names from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ entries: [{ name: 'NODE_OPTIONS', value: 'unsafe' }] })
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient();

    await expect(client.sync()).rejects.toBeInstanceOf(AegisResponseError);
    expect(client.getAll()).toEqual({});
  });

  it('runs a child with injected secrets and strips Aegis variables', async () => {
    process.env.RUN_SECRET = 'old-value';
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ entries: [{ name: 'RUN_SECRET', value: 'test-value' }] })
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createClient();

    const code = await client.run([
      process.execPath,
      '-e',
      'process.exit(process.env.RUN_SECRET === "test-value" && !process.env.AEGIS_SERVICE_TOKEN ? 0 : 1)',
    ]);

    expect(code).toBe(0);
  });

  it('fails clearly when imported in a browser', async () => {
    vi.stubGlobal('window', {});
    vi.resetModules();
    await expect(import('./index')).rejects.toThrow('server-side Node.js');
  });
});
