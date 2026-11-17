import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { GeneratedDataKey, KeyProvider, WrappedKeyRecord } from './key-provider';

const DEK_LENGTH = 32;
const IV_LENGTH = 12;

export class EnvKeyProvider implements KeyProvider {
  readonly keyId: string;
  private readonly kek: Buffer;

  constructor(masterKey: string, keyId = 'env-master-v1') {
    if (!masterKey) {
      throw new Error('AEGIS_MASTER_KEY is required');
    }
    this.keyId = keyId;
    this.kek = createHash('sha256').update(masterKey).digest();
  }

  async generateDataKey(): Promise<GeneratedDataKey> {
    const plaintext = randomBytes(DEK_LENGTH);
    const dekIv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.kek, dekIv);
    cipher.setAAD(Buffer.from(this.keyId));
    const wrapped = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      plaintext,
      wrappedDek: wrapped.toString('base64'),
      dekIv: dekIv.toString('base64'),
      dekAuthTag: cipher.getAuthTag().toString('base64'),
    };
  }

  async decryptDataKey(record: WrappedKeyRecord): Promise<Buffer> {
    if (!record.wrappedDek || !record.dekIv || !record.dekAuthTag) {
      throw new Error('Invalid wrapped data key');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.kek, Buffer.from(record.dekIv, 'base64'));
    decipher.setAAD(Buffer.from(this.keyId));
    decipher.setAuthTag(Buffer.from(record.dekAuthTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.wrappedDek, 'base64')),
      decipher.final(),
    ]);
  }
}
