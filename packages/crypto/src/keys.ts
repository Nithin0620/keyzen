import { createHash, hkdfSync, randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure 256-bit random key.
 */
export function generateProjectKey(): Buffer {
  return randomBytes(32);
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
