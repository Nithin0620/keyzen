import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { validateEnv } from '../config/env';
import { EnvelopeCipherService } from './envelope-cipher.service';
import { EnvKeyProvider } from './env-key.provider';
import { KEY_PROVIDERS, type KeyProvider } from './key-provider';
import { KeyProviderRegistry } from './key-provider.registry';
import { KmsKeyProvider } from './kms-key.provider';
import { ValueCipherService } from './value-cipher.service';

@Global()
@Module({})
export class CryptoModule {
  static forRoot(): DynamicModule {
    const env = validateEnv();
    const providers: KeyProvider[] = [];
    if (env.AEGIS_KMS_KEY_ID) {
      providers.push(new KmsKeyProvider(env.AEGIS_KMS_KEY_ID));
    }
    if (env.AEGIS_MASTER_KEY) {
      providers.push(new EnvKeyProvider(env.AEGIS_MASTER_KEY));
    }
    const keyProviders: Provider = { provide: KEY_PROVIDERS, useValue: providers };
    const masterKey: Provider = { provide: 'AEGIS_MASTER_KEY', useValue: env.AEGIS_MASTER_KEY };
    return {
      module: CryptoModule,
      providers: [
        keyProviders,
        masterKey,
        KeyProviderRegistry,
        ValueCipherService,
        EnvelopeCipherService,
      ],
      exports: [KEY_PROVIDERS, KeyProviderRegistry, ValueCipherService, EnvelopeCipherService],
    };
  }
}
