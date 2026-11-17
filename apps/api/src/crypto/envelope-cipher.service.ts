import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { KeyProviderRegistry } from './key-provider.registry';
import { ValueCipherService } from './value-cipher.service';

export const ENVELOPE_CIPHER_VERSION = 2;
const IV_LENGTH = 12;

export interface EnvelopeCipherRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedDek?: string;
  dekIv?: string;
  dekAuthTag?: string;
  keyId: string;
  cipherVersion: number;
}

@Injectable()
export class EnvelopeCipherService {
  constructor(
    private readonly registry: KeyProviderRegistry,
    private readonly legacy: ValueCipherService
  ) {}

  async encrypt(plaintext: string, aad: string, keyId?: string): Promise<EnvelopeCipherRecord> {
    const provider = this.registry.get(keyId ?? this.registry.defaultKeyId());
    const dataKey = await provider.generateDataKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', dataKey.plaintext, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      wrappedDek: dataKey.wrappedDek,
      dekIv: dataKey.dekIv,
      dekAuthTag: dataKey.dekAuthTag,
      keyId: provider.keyId,
      cipherVersion: ENVELOPE_CIPHER_VERSION,
    };
  }

  async decrypt(record: EnvelopeCipherRecord, aad: string): Promise<string> {
    if (record.cipherVersion === 1) {
      return this.legacy.decrypt(record, aad);
    }
    if (record.cipherVersion !== ENVELOPE_CIPHER_VERSION) {
      throw new Error('Unsupported cipher version');
    }
    const provider = this.registry.get(record.keyId);
    const dataKey = await provider.decryptDataKey(record);
    const decipher = createDecipheriv('aes-256-gcm', dataKey, Buffer.from(record.iv, 'base64'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
