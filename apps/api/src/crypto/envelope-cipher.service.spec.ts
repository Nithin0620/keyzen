import { describe, expect, it } from 'vitest';
import { EnvelopeCipherService } from './envelope-cipher.service';
import { EnvKeyProvider } from './env-key.provider';
import { KeyProviderRegistry } from './key-provider.registry';
import { ValueCipherService, valueAad } from './value-cipher.service';

const FIRST_MASTER = Buffer.alloc(32, 11).toString('base64');
const SECOND_MASTER = Buffer.alloc(32, 22).toString('base64');
const AAD = valueAad('a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24), 'd'.repeat(24));

describe('EnvelopeCipherService', () => {
  const first = new EnvKeyProvider(FIRST_MASTER);
  const second = new EnvKeyProvider(SECOND_MASTER, 'env-master-v2');
  const registry = new KeyProviderRegistry([first, second]);
  const cipher = new EnvelopeCipherService(registry, new ValueCipherService(FIRST_MASTER));

  it('uses a fresh DEK and 96-bit IV for every value', async () => {
    const one = await cipher.encrypt('secret-value', AAD);
    const two = await cipher.encrypt('secret-value', AAD);
    expect(one.wrappedDek).toBeTruthy();
    expect(Buffer.from(one.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(one.dekIv!, 'base64')).toHaveLength(12);
    expect(one.wrappedDek).not.toBe(two.wrappedDek);
    expect(one.iv).not.toBe(two.iv);
    expect(await cipher.decrypt(one, AAD)).toBe('secret-value');
  });

  it('fails when ciphertext is swapped to another secret AAD', async () => {
    const encrypted = await cipher.encrypt('secret-value', AAD);
    const otherAad = valueAad('a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24), 'e'.repeat(24));
    await expect(cipher.decrypt(encrypted, otherAad)).rejects.toThrow();
  });

  it('dual-reads legacy values and re-encrypts them under a new key id', async () => {
    const legacy = new ValueCipherService(FIRST_MASTER).encrypt('legacy-value', AAD);
    expect(await cipher.decrypt(legacy, AAD)).toBe('legacy-value');
    const rotated = await cipher.encrypt(await cipher.decrypt(legacy, AAD), AAD, 'env-master-v2');
    expect(rotated.keyId).toBe('env-master-v2');
    expect(rotated.cipherVersion).toBe(2);
    expect(await cipher.decrypt(rotated, AAD)).toBe('legacy-value');
  });

  it('rejects unknown key ids', async () => {
    await expect(cipher.encrypt('value', AAD, 'missing-key')).rejects.toThrow('Unknown key provider');
  });
});
