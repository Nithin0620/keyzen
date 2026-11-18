import process from 'node:process';
import { CliError } from './errors';

const SERVICE = 'aegis-cli';
const ACCOUNT = 'service-token';

export interface CredentialStore {
  readonly kind: 'keychain' | 'environment';
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  delete(): Promise<void>;
}

export class KeychainCredentialStore implements CredentialStore {
  readonly kind = 'keychain' as const;

  async get(): Promise<string | null> {
    const entry = await this.entry();
    return entry.getPassword() ?? null;
  }

  async set(token: string): Promise<void> {
    const entry = await this.entry();
    entry.setPassword(token);
  }

  async delete(): Promise<void> {
    const entry = await this.entry();
    entry.deletePassword();
  }

  private async entry() {
    const { Entry } = await import('@napi-rs/keyring');
    return new Entry(SERVICE, ACCOUNT);
  }
}

export class EnvironmentCredentialStore implements CredentialStore {
  readonly kind = 'environment' as const;

  async get(): Promise<string | null> {
    return process.env.AEGIS_SERVICE_TOKEN ?? null;
  }

  async set(): Promise<void> {
    throw new CliError('OS keychain is unavailable; set AEGIS_SERVICE_TOKEN in the environment', 'KEYCHAIN_UNAVAILABLE');
  }

  async delete(): Promise<void> {
    throw new CliError('OS keychain is unavailable; unset AEGIS_SERVICE_TOKEN in the environment', 'KEYCHAIN_UNAVAILABLE');
  }
}

export async function createCredentialStore(): Promise<CredentialStore> {
  try {
    const { Entry } = await import('@napi-rs/keyring');
    new Entry(SERVICE, ACCOUNT);
    return new KeychainCredentialStore();
  } catch {
    return new EnvironmentCredentialStore();
  }
}
