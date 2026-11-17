import { describe, expect, it } from 'vitest';
import { assertSafeInput, UnsafeInputError } from './safe-input';

describe('assertSafeInput', () => {
  it('accepts plain nested objects', () => {
    expect(() => assertSafeInput({ name: 'DATABASE_URL', nested: { a: 1 } })).not.toThrow();
  });

  it('rejects operator keys', () => {
    expect(() => assertSafeInput({ $where: '1 === 1' })).toThrow(UnsafeInputError);
  });

  it('rejects dotted keys', () => {
    expect(() => assertSafeInput({ 'workspaceId.$ne': null })).toThrow(UnsafeInputError);
  });

  it('rejects unsafe keys nested in arrays', () => {
    expect(() => assertSafeInput({ a: [{ $ne: null }] })).toThrow(UnsafeInputError);
  });
});
