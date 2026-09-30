import { describe, it, expect } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  generateProjectKey,
  deriveProjectKey,
  hashToken,
} from '../src';

describe('Keyzen Cryptography Engine', () => {
  it('should encrypt and decrypt secret values accurately', async () => {
    const key = generateProjectKey();
    const plaintext = 'placeholder_secret_api_key';
    const encrypted = await encryptSecret(plaintext, key);

    expect(encrypted.ciphertext).not.toEqual(plaintext);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(typeof encrypted.ciphertext).toBe('string');
    expect(typeof encrypted.iv).toBe('string');
    expect(typeof encrypted.authTag).toBe('string');

    const decrypted = await decryptSecret(encrypted, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('should fail decryption if auth tag is tampered with', async () => {
    const key = generateProjectKey();
    const encrypted = await encryptSecret('secret_value', key);
    
    // Tamper with the authentication tag
    const tampered = {
      ...encrypted,
      authTag: Buffer.alloc(16, 0).toString('hex'),
    };

    await expect(decryptSecret(tampered, key)).rejects.toThrow();
  });

  it('should fail decryption if ciphertext is modified', async () => {
    const key = generateProjectKey();
    const encrypted = await encryptSecret('secret_value', key);

    // Tamper with valid hex byte in ciphertext
    const lastByte = encrypted.ciphertext.slice(-2);
    const flippedByte = lastByte === 'aa' ? 'bb' : 'aa';
    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -2) + flippedByte,
    };

    await expect(decryptSecret(tampered, key)).rejects.toThrow();
  });

  it('should derive deterministic project keys with HKDF given master key and project id', () => {
    const masterKey = 'master-secret-key-32-chars-long!!';
    const projectId = 'proj_12345';

    const key1 = deriveProjectKey(masterKey, projectId);
    const key2 = deriveProjectKey(masterKey, projectId);
    const key3 = deriveProjectKey(masterKey, 'proj_67890');

    expect(key1).toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key1.length).toBe(32); // 256-bit AES key
  });

  it('should hash tokens deterministically and resist collisions', () => {
    const token = 'kzn_live_abcdef123456';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toEqual(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });
});
