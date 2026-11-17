import { describe, expect, it } from 'vitest';
import { maskSecretValue } from './secret-mask';

describe('maskSecretValue', () => {
  it('never exposes the full value', () => {
    expect(maskSecretValue('short')).toBe('•••••');
    const masked = maskSecretValue('super-secret-value');
    expect(masked).toContain('••••••••');
    expect(masked).toContain('su');
    expect(masked).toContain('ue');
    expect(masked).not.toContain('super-secret');
  });
});
