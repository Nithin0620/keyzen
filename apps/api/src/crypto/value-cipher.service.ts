import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { validateEnv } from '../config/env';

export interface ValueCipherRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
  cipherVersion: number;
}

const KEY_ID = 'aegis-master-v1';
const CIPHER_VERSION = 1;
const IV_LENGTH = 12;

export function valueAad(
  workspaceId: string,
  projectId: string,
  environmentId: string,
  secretId: string
): string {
  return [workspaceId, projectId, environmentId, secretId].join(':');
}

@Injectable()
export class ValueCipherService {
  private key?: Buffer;

  constructor(
    @Optional()
    @Inject('AEGIS_MASTER_KEY')
    private readonly masterKey?: string
  ) {}

  private getKey(): Buffer {
    if (!this.key) {
      const source = this.masterKey ?? validateEnv().AEGIS_MASTER_KEY;
      if (!source) {
        throw new Error('AEGIS_MASTER_KEY is required for secret duplication');
      }
      this.key = createHash('sha256').update(source).digest();
    }
    return this.key;
  }

  encrypt(plaintext: string, aad: string): ValueCipherRecord {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyId: KEY_ID,
      cipherVersion: CIPHER_VERSION,
    };
  }

  decrypt(record: ValueCipherRecord, aad: string): string {
    if (record.keyId !== KEY_ID || record.cipherVersion !== CIPHER_VERSION) {
      throw new Error('Unsupported encrypted value');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(record.iv, 'base64'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
