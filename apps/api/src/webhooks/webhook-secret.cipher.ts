import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { validateEnv } from '../config/env';
import { randomToken } from '../common/tokens';

const KEY_ID = 'webhook-secret-v1';
const IV_LENGTH = 12;

export interface WebhookSecretRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}

export function generateWebhookSecret(): string {
  return `whsec_${randomToken(32)}`;
}

export function webhookSecretAad(workspaceId: string, projectId: string, webhookId: string): string {
  return [workspaceId, projectId, webhookId].join(':');
}

export class WebhookSecretCipher {
  private readonly key: Buffer;

  constructor(encryptionKey?: string) {
    const env = validateEnv();
    const source = encryptionKey ?? env.WEBHOOK_SECRET_ENCRYPTION_KEY ?? env.AEGIS_MASTER_KEY;
    if (!source) {
      throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY is required');
    }
    this.key = createHash('sha256').update(source).digest();
  }

  encrypt(secret: string, workspaceId: string, projectId: string, webhookId: string): WebhookSecretRecord {
    const iv = randomToken(IV_LENGTH);
    const ivBuffer = Buffer.from(iv, 'base64url');
    const cipher = createCipheriv('aes-256-gcm', this.key, ivBuffer);
    cipher.setAAD(Buffer.from(webhookSecretAad(workspaceId, projectId, webhookId)));
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: ivBuffer.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyId: KEY_ID,
    };
  }

  decrypt(record: WebhookSecretRecord, workspaceId: string, projectId: string, webhookId: string): string {
    if (record.keyId !== KEY_ID) {
      throw new Error('Unsupported webhook secret key');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(record.iv, 'base64'));
    decipher.setAAD(Buffer.from(webhookSecretAad(workspaceId, projectId, webhookId)));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
