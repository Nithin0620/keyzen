import type { KeyProvider } from './key-provider';

export class KeyProviderRegistry {
  private readonly providers: Map<string, KeyProvider>;

  constructor(providers: KeyProvider[]) {
    this.providers = new Map();
    for (const provider of providers) {
      if (this.providers.has(provider.keyId)) {
        throw new Error('Duplicate key provider id');
      }
      this.providers.set(provider.keyId, provider);
    }
  }

  get(keyId: string): KeyProvider {
    const provider = this.providers.get(keyId);
    if (!provider) {
      throw new Error('Unknown key provider');
    }
    return provider;
  }

  defaultKeyId(): string {
    const keyId = this.providers.keys().next().value;
    if (!keyId) {
      throw new Error('No key provider configured');
    }
    return keyId;
  }

  has(keyId: string): boolean {
    return this.providers.has(keyId);
  }
}
