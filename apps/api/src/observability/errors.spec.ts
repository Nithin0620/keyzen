import { describe, expect, it } from 'vitest';
import { redactEvent } from './errors';

describe('redactEvent', () => {
  it('redacts credentials from messages, breadcrumbs, request data and contexts', () => {
    const event = {
      message: 'failed authorization=Bearer abcdefghijklmnop for mongodb://user:pass@db.example.com/aegis',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'token=supersecretvalue1234567890',
            stacktrace: { frames: [{ function: 'connect', context_line: 'password=hunter2' }] },
          },
        ],
      },
      breadcrumbs: {
        values: [
          {
            message: 'api_key=abcdefghijklmnopqrstuvwxyz',
            data: { authorization: 'Bearer qwerty', nested: { secret: 'hidden' } },
          },
        ],
      },
      request: {
        url: 'https://api.example.com/v1?token=abcdefghijklmnop',
        headers: { authorization: 'Bearer qwerty', cookie: 'session=abc' },
        cookies: 'session=abc',
        data: { password: 'hunter2' },
      },
      extra: { nested: { apiKey: 'visible-key', safe: 'ok' } },
      contexts: { aegis: { token: 'tok' } },
      tags: { secret: 's' },
    };

    const redacted = redactEvent(event) as any;
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('pass@db.example.com');
    expect(serialized).not.toContain('supersecretvalue1234567890');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(redacted.contexts.aegis.token).toBe('[REDACTED]');
    expect(redacted.breadcrumbs.values[0].data.authorization).toBe('[REDACTED]');
    expect(redacted.request.headers.authorization).toBe('[REDACTED]');
    expect(redacted.request.data.password).toBe('[REDACTED]');
  });
});
