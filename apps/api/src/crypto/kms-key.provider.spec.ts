import type { KMSClient } from '@aws-sdk/client-kms';
import { describe, expect, it, vi } from 'vitest';
import { KmsKeyProvider } from './kms-key.provider';

describe('KmsKeyProvider', () => {
  it('uses KMS generate/decrypt for data keys', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Plaintext: Uint8Array.from([1, 2, 3]),
        CiphertextBlob: Uint8Array.from([4, 5, 6]),
      })
      .mockResolvedValueOnce({ Plaintext: Uint8Array.from([1, 2, 3]) });
    const provider = new KmsKeyProvider('arn:aws:kms:key', { send } as unknown as KMSClient);
    const generated = await provider.generateDataKey();
    expect(generated.plaintext).toEqual(Buffer.from([1, 2, 3]));
    expect(generated.wrappedDek).toBe(Buffer.from([4, 5, 6]).toString('base64'));
    expect(await provider.decryptDataKey({ keyId: provider.keyId, wrappedDek: generated.wrappedDek })).toEqual(
      Buffer.from([1, 2, 3])
    );
    expect(send).toHaveBeenCalledTimes(2);
  });
});
