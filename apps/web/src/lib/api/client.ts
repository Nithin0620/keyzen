import { ApiError, toApiFieldErrors } from './errors';
import { parseRateLimitHeaders } from './headers';

const DEFAULT_API_URL = 'http://localhost:3001';
const REFRESH_PATH = '/auth/refresh';
let refreshPromise: Promise<boolean> | null = null;

type SearchParamValue = string | number | boolean | null | undefined;
export type ApiSearchParams = URLSearchParams | Record<string, SearchParamValue>;
export type ApiBody = BodyInit | Record<string, unknown> | readonly unknown[] | null;

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: ApiBody;
  searchParams?: ApiSearchParams;
  skipRefresh?: boolean;
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL must be configured in production');
  }
  return DEFAULT_API_URL;
}

function buildUrl(path: string, searchParams?: ApiSearchParams): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);

  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => url.searchParams.append(key, value));
  } else if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function isNativeBody(body: ApiBody): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams ||
    ArrayBuffer.isView(body)
  );
}

function serializeBody(body: ApiBody | undefined): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (isNativeBody(body)) return body;
  return JSON.stringify(body);
}

async function parsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function readValue(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined;
  return (payload as Record<string, unknown>)[key];
}

function readString(payload: unknown, key: string): string | undefined {
  const value = readValue(payload, key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function errorMessage(payload: unknown, status: number): string {
  return readString(payload, 'message') ?? `Request failed with status ${status}`;
}

async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(buildUrl(REFRESH_PATH), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, searchParams, skipRefresh = false, headers: optionHeaders, ...requestInit } = options;
  const headers = new Headers(optionHeaders);
  const serializedBody = serializeBody(body);

  headers.set('Accept', 'application/json');
  if (serializedBody !== undefined && body !== undefined && !isNativeBody(body)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path, searchParams), {
    ...requestInit,
    method: requestInit.method ?? 'GET',
    credentials: 'include',
    headers,
    body: serializedBody,
  });

  if (response.status === 401 && !skipRefresh && !path.startsWith(REFRESH_PATH)) {
    if (await refreshSessionOnce()) {
      return apiFetch<T>(path, { ...options, skipRefresh: true });
    }
  }

  const payload = await parsePayload(response);
  const rateLimit = parseRateLimitHeaders(response.headers);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message: errorMessage(payload, response.status),
      code: readString(payload, 'code'),
      fields: toApiFieldErrors(readValue(payload, 'fields')),
      requestId: response.headers.get('X-Request-Id'),
      rateLimit,
    });
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: ApiBody, options?: Omit<ApiRequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: ApiBody, options?: Omit<ApiRequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: ApiBody, options?: Omit<ApiRequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<ApiRequestOptions, 'body' | 'method'>) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
