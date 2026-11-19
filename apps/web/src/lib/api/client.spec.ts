import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, getApiBaseUrl } from './client';
import { ApiError } from './errors';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('builds credentialed requests from the configured base URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4567/');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ status: string }>('/health/live', {
      searchParams: { verbose: true, missing: undefined },
      headers: { 'X-Test': '1' },
    });

    expect(result).toEqual({ status: 'ok' });
    expect(getApiBaseUrl()).toBe('http://localhost:4567');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4567/health/live?verbose=true');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.headers.get('Accept')).toBe('application/json');
    expect(init.headers.get('X-Test')).toBe('1');
  });

  it('throws a structured ApiError with request and rate-limit metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { message: 'Invalid input', code: 'VALIDATION_ERROR', fields: { name: 'Required' } },
        {
          status: 400,
          headers: {
            'X-Request-Id': 'req-2',
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
          },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/signup', { method: 'POST', body: { email: 'user@example.com' } }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Invalid input',
      code: 'VALIDATION_ERROR',
      fields: { name: 'Required' },
      requestId: 'req-2',
      rateLimit: { retryAfter: 60, remaining: 0 },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"email":"user@example.com"}');
  });

  it('refreshes once and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'user-1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/auth/me')).resolves.toEqual({ user: { id: 'user-1' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3001/auth/refresh');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:3001/auth/me');
  });

  it('does not recursively refresh the refresh endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh request across concurrent 401 responses', async () => {
    let refreshCalls = 0;
    const pendingFirstAttempts = new Set(['/a', '/b']);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/refresh') {
        refreshCalls += 1;
        return new Response('', { status: 200 });
      }
      if (pendingFirstAttempts.has(url.pathname)) {
        pendingFirstAttempts.delete(url.pathname);
        return new Response('', { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(Promise.all([apiFetch('/a'), apiFetch('/b')])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('requires an explicit API URL in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');

    expect(() => getApiBaseUrl()).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
