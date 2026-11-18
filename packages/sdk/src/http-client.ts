import {
  AegisAuthenticationError,
  AegisNetworkError,
  AegisRateLimitError,
  AegisResponseError,
} from './errors';

export interface RuntimeRequest {
  endpoint: string;
  path: string;
  method: 'GET' | 'POST';
  token: string;
  timeoutMs: number;
  retries: number;
  body?: Record<string, unknown>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoff(attempt: number): number {
  return Math.min(500, 50 * 2 ** attempt) + Math.floor(Math.random() * 50);
}

export async function requestJson<T>(request: RuntimeRequest): Promise<T> {
  const url = new URL(`${request.endpoint}${request.path}`);

  for (let attempt = 0; attempt <= request.retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await fetch(url, {
        method: request.method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${request.token}`,
          ...(request.body ? { 'content-type': 'application/json' } : {}),
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new AegisAuthenticationError();
      }

      if (response.status === 429) {
        if (attempt === request.retries) {
          throw new AegisRateLimitError();
        }
        await wait(backoff(attempt));
        continue;
      }

      if (response.status >= 500) {
        if (attempt === request.retries) {
          throw new AegisNetworkError('Aegis API request failed');
        }
        await wait(backoff(attempt));
        continue;
      }

      if (!response.ok) {
        throw new AegisNetworkError('Aegis API request failed');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AegisResponseError();
      }

      return payload as T;
    } catch (error) {
      if (error instanceof AegisAuthenticationError || error instanceof AegisRateLimitError) {
        throw error;
      }
      if (error instanceof AegisNetworkError || error instanceof AegisResponseError) {
        throw error;
      }
      if (attempt === request.retries) {
        if (controller.signal.aborted) {
          throw new AegisNetworkError('Aegis API request timed out');
        }
        throw new AegisNetworkError('Aegis API request failed');
      }
      await wait(backoff(attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new AegisNetworkError('Aegis API request failed');
}
