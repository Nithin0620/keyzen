import { deriveProjectKey, encryptSecret, decryptSecret, EncryptedPayload } from '@keyzen/crypto';
import { config } from '../config';

export class CryptoService {
  private masterKey: string;

  constructor(masterKey: string = config.KEYZEN_MASTER_KEY) {
    this.masterKey = masterKey;
  }

  getProjectKey(projectId: string): Buffer {
    return deriveProjectKey(this.masterKey, projectId);
  }

  async encryptForProject(projectId: string, plaintext: string): Promise<EncryptedPayload> {
    const key = this.getProjectKey(projectId);
    return encryptSecret(plaintext, key, projectId);
  }

  async decryptForProject(projectId: string, payload: EncryptedPayload): Promise<string> {
    const key = this.getProjectKey(projectId);
    return decryptSecret(payload, key, projectId);
  }
}

export const cryptoService = new CryptoService();
