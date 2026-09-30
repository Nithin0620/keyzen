import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EncryptedPayload } from './types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Encrypts a plaintext string using AES-256-GCM authenticated encryption.
 */
export async function encryptSecret(
  plaintext: string,
  key: Buffer,
  additionalData?: string
): Promise<EncryptedPayload> {
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (256 bits)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  if (additionalData) {
    cipher.setAAD(Buffer.from(additionalData, 'utf8'));
  }

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts an EncryptedPayload using AES-256-GCM.
 * Throws an error if ciphertext or auth tag has been tampered with.
 */
export async function decryptSecret(
  payload: EncryptedPayload,
  key: Buffer,
  additionalData?: string
): Promise<string> {
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (256 bits)');
  }

  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  if (additionalData) {
    decipher.setAAD(Buffer.from(additionalData, 'utf8'));
  }

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
