import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient as DefaultKmsClient,
  type KMSClient,
} from '@aws-sdk/client-kms';
import type { GeneratedDataKey, KeyProvider, WrappedKeyRecord } from './key-provider';

export class KmsKeyProvider implements KeyProvider {
  private readonly client: KMSClient;

  constructor(readonly keyId: string, client?: KMSClient) {
    if (!keyId) {
      throw new Error('AEGIS_KMS_KEY_ID is required');
    }
    this.client = client ?? new DefaultKmsClient({});
  }

  async generateDataKey(): Promise<GeneratedDataKey> {
    const result = await this.client.send(
      new GenerateDataKeyCommand({ KeyId: this.keyId, KeySpec: 'AES_256' })
    );
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error('KMS did not return a data key');
    }
    return {
      plaintext: Buffer.from(result.Plaintext),
      wrappedDek: Buffer.from(result.CiphertextBlob).toString('base64'),
    };
  }

  async decryptDataKey(record: WrappedKeyRecord): Promise<Buffer> {
    if (!record.wrappedDek) {
      throw new Error('Invalid wrapped data key');
    }
    const result = await this.client.send(
      new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: Buffer.from(record.wrappedDek, 'base64'),
      })
    );
    if (!result.Plaintext) {
      throw new Error('KMS did not return a data key');
    }
    return Buffer.from(result.Plaintext);
  }
}
