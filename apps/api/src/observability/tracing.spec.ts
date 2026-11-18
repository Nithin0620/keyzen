import { describe, expect, it } from 'vitest';
import type { Env } from '../config/env';
import { safeSpanAttributes, startTracing, stopTracing } from './tracing';

describe('tracing', () => {
  it('redacts sensitive span attributes', () => {
    expect(
      safeSpanAttributes({
        'http.method': 'GET',
        authorization: 'Bearer ags_abcdefghijklmnopqrstuvwxyz',
        token: 'ags_abcdefghijklmnopqrstuvwxyz',
        workspaceId: 'workspace-1',
      })
    ).toEqual({
      'http.method': 'GET',
      authorization: '[REDACTED]',
      token: '[REDACTED]',
      workspaceId: 'workspace-1',
    });
  });

  it('does not start tracing when disabled', async () => {
    startTracing({ OTEL_ENABLED: false } as Env);
    await expect(stopTracing()).resolves.toBeUndefined();
  });
});
