import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Derives a deterministic 256-bit Project Encryption Key from a Master Key and Project ID using HKDF-SHA256.
 */
export function deriveProjectKey(masterKey: string, projectId: string): Buffer {
  const masterKeyBuffer = Buffer.from(masterKey, 'utf8');
  const salt = createHash('sha256').update(`keyzen:salt:${projectId}`).digest();
  const info = Buffer.from(`keyzen:dek:${projectId}`, 'utf8');
  return Buffer.from(hkdfSync('sha256', masterKeyBuffer, salt, info, 32));
}

/**
 * Encrypts a plaintext string using AES-256-GCM authenticated encryption.
 */
export function encryptSecret(
  plaintext: string,
  key: Buffer,
  additionalData?: string
): EncryptedPayload {
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
 */
export function decryptSecret(
  payload: EncryptedPayload,
  key: Buffer,
  additionalData?: string
): string {
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (256 bits)');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  if (additionalData) {
    decipher.setAAD(Buffer.from(additionalData, 'utf8'));
  }

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Computes a SHA-256 hash of a service token for secure lookup.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a secure random service token string with prefix `kzn_`.
 */
export function generateServiceToken(environment: string = 'prod'): { token: string; hash: string } {
  const rawBytes = randomBytes(24).toString('base64url');
  const token = `kzn_${environment}_${rawBytes}`;
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * High-level helper to encrypt for a given project ID using process.env.KEYZEN_MASTER_KEY
 */
export function encryptForProject(projectId: string, plaintext: string): EncryptedPayload {
  const masterKey = process.env.KEYZEN_MASTER_KEY || 'keyzen_dev_master_key_must_be_32_bytes_or_more_secure!';
  const key = deriveProjectKey(masterKey, projectId);
  return encryptSecret(plaintext, key, projectId);
}

/**
 * High-level helper to decrypt for a given project ID using process.env.KEYZEN_MASTER_KEY
 */
export function decryptForProject(projectId: string, payload: EncryptedPayload): string {
  const masterKey = process.env.KEYZEN_MASTER_KEY || 'keyzen_dev_master_key_must_be_32_bytes_or_more_secure!';
  const key = deriveProjectKey(masterKey, projectId);
  return decryptSecret(payload, key, projectId);
}
