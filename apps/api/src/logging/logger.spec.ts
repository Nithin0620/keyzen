import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

describe('logger redaction', () => {
  it('never writes secret values to the log sink', () => {
    const output: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        output.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger(sink);
    logger.info({ value: 'super-secret-value', nested: { password: 'pw' } }, 'secret event');
    const logged = output.join('');
    expect(logged).not.toContain('super-secret-value');
    expect(logged).not.toContain('pw');
    expect(logged).toContain('[REDACTED]');
  });
});
