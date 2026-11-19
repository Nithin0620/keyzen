import type { RateLimitInfo } from './errors';

function readNumber(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const info: RateLimitInfo = {
    limit: readNumber(headers, 'X-RateLimit-Limit'),
    remaining: readNumber(headers, 'X-RateLimit-Remaining'),
    reset: readNumber(headers, 'X-RateLimit-Reset'),
    retryAfter: readNumber(headers, 'Retry-After'),
  };

  for (const key of Object.keys(info) as Array<keyof RateLimitInfo>) {
    if (info[key] === undefined) delete info[key];
  }

  return info;
}
