export const KEY_PROVIDERS = Symbol('KEY_PROVIDERS');

export interface GeneratedDataKey {
  plaintext: Buffer;
  wrappedDek: string;
  dekIv?: string;
  dekAuthTag?: string;
}

export interface WrappedKeyRecord {
  keyId: string;
  wrappedDek?: string;
  dekIv?: string;
  dekAuthTag?: string;
}

export interface KeyProvider {
  readonly keyId: string;
  generateDataKey(): Promise<GeneratedDataKey>;
  decryptDataKey(record: WrappedKeyRecord): Promise<Buffer>;
}
