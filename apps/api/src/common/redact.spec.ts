import { describe, expect, it } from 'vitest';
import { redactSensitive } from './redact';

describe('redactSensitive', () => {
  it('removes secret-bearing keys from nested metadata', () => {
    const redacted = redactSensitive({
      route: 'secrets.create',
      secretId: 'secret-1',
      value: 'plaintext',
      nested: { password: 'pw', token: 'tok', safe: 'ok' },
    });
    expect(redacted).toEqual({
      route: 'secrets.create',
      secretId: 'secret-1',
      value: '[REDACTED]',
      nested: { password: '[REDACTED]', token: '[REDACTED]', safe: 'ok' },
    });
  });

  it('redacts sensitive keys inside arrays', () => {
    expect(redactSensitive([{ apiKey: 'key' }, { workspaceId: 'workspace-1' }])).toEqual([
      { apiKey: '[REDACTED]' },
      { workspaceId: 'workspace-1' },
    ]);
  });
});
