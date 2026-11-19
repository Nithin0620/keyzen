import { describe, expect, it } from 'vitest';
import { parseRateLimitHeaders } from './headers';

describe('parseRateLimitHeaders', () => {
  it('parses known numeric headers and ignores invalid values', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': '300',
      'X-RateLimit-Remaining': '12',
      'X-RateLimit-Reset': '1893456000',
      'Retry-After': '60',
    });

    expect(parseRateLimitHeaders(headers)).toEqual({
      limit: 300,
      remaining: 12,
      reset: 1893456000,
      retryAfter: 60,
    });
  });

  it('omits missing and non-numeric values', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': 'not-a-number',
      'Retry-After': '',
    });

    expect(parseRateLimitHeaders(headers)).toEqual({});
  });
});
