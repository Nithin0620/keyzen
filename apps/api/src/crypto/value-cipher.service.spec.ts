import { describe, expect, it } from 'vitest';
import { ValueCipherService, valueAad } from './value-cipher.service';

describe('ValueCipherService', () => {
  const cipher = new ValueCipherService(Buffer.alloc(32, 3).toString('base64'));

  it('round-trips values with AAD-bound AES-GCM encryption', () => {
    const aad = valueAad('a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24), 'd'.repeat(24));
    const encrypted = cipher.encrypt('secret-value', aad);
    expect(encrypted.ciphertext).not.toContain('secret-value');
    expect(cipher.decrypt(encrypted, aad)).toBe('secret-value');
  });

  it('fails to decrypt when the AAD changes', () => {
    const first = valueAad('a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24), 'd'.repeat(24));
    const second = valueAad('a'.repeat(24), 'b'.repeat(24), 'e'.repeat(24), 'd'.repeat(24));
    const encrypted = cipher.encrypt('secret-value', first);
    expect(() => cipher.decrypt(encrypted, second)).toThrow();
  });
});
