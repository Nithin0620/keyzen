import { Types, type Model } from 'mongoose';
import { BadRequestException } from '../common/http-error';
import { EnvelopeCipherService } from '../crypto/envelope-cipher.service';
import { KeyProviderRegistry } from '../crypto/key-provider.registry';
import { valueAad } from '../crypto/value-cipher.service';
import { ProjectAccessService } from '../projects/project-access.service';
import type { SecretRecord, SecretValueRecord } from './types';

export class KeyRotationService {
  constructor(
    private readonly secrets: Model<SecretRecord>,
    private readonly secretValues: Model<SecretValueRecord>,
    private readonly access: ProjectAccessService,
    private readonly cipher: EnvelopeCipherService,
    private readonly registry: KeyProviderRegistry
  ) {}

  async rotateDueKeys(targetKeyId: string): Promise<number> {
    if (!this.registry.has(targetKeyId)) {
      throw new BadRequestException('Unknown key id');
    }
    const values = await this.secretValues
      .find({ $or: [{ keyId: { $ne: targetKeyId } }, { cipherVersion: { $ne: 2 } }] })
      .exec();
    const secrets = await this.secrets
      .find({ _id: { $in: values.map((value) => value.secretId) } })
      .exec();
    const projectBySecret = new Map(secrets.map((secret) => [String(secret._id), String(secret.projectId)]));
    let rotated = 0;
    for (const value of values) {
      const projectId = projectBySecret.get(String(value.secretId));
      if (!projectId) {
        continue;
      }
      const workspaceId = String(value.workspaceId);
      const aad = valueAad(workspaceId, projectId, String(value.environmentId), String(value.secretId));
      const plaintext = await this.cipher.decrypt(value, aad);
      const encrypted = await this.cipher.encrypt(plaintext, aad, targetKeyId);
      await this.secretValues.updateOne({ _id: (value as any)._id }, { $set: encrypted });
      rotated += 1;
    }
    return rotated;
  }

  async rotateProjectKeys(
    userId: string,
    workspaceId: string,
    projectId: string,
    targetKeyId: string
  ): Promise<{ rotated: number }> {
    if (!this.registry.has(targetKeyId)) {
      throw new BadRequestException('Unknown key id');
    }
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const secrets = await this.secrets
      .find({ projectId: new Types.ObjectId(projectId), workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    const values = await this.secretValues
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        secretId: { $in: secrets.map((secret) => secret._id) },
      })
      .exec();
    let rotated = 0;
    for (const value of values) {
      if (value.keyId === targetKeyId && value.cipherVersion === 2) {
        continue;
      }
      const aad = valueAad(workspaceId, projectId, String(value.environmentId), String(value.secretId));
      const plaintext = await this.cipher.decrypt(value, aad);
      const encrypted = await this.cipher.encrypt(plaintext, aad, targetKeyId);
      await this.secretValues.updateOne({ _id: (value as any)._id }, { $set: encrypted });
      rotated += 1;
    }
    return { rotated };
  }
}
