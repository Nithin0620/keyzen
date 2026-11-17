import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { EnvelopeCipherService } from '../crypto/envelope-cipher.service';
import { KeyProviderRegistry } from '../crypto/key-provider.registry';
import { valueAad } from '../crypto/value-cipher.service';
import { SECRET_MODEL, SECRET_VALUE_MODEL } from '../database/schemas';
import { ProjectAccessService } from '../projects/project-access.service';
import type { SecretRecord, SecretValueRecord } from './types';

@Injectable()
export class KeyRotationService {
  constructor(
    @InjectModel(SECRET_MODEL) private readonly secrets: Model<SecretRecord>,
    @InjectModel(SECRET_VALUE_MODEL) private readonly secretValues: Model<SecretValueRecord>,
    private readonly access: ProjectAccessService,
    private readonly cipher: EnvelopeCipherService,
    private readonly registry: KeyProviderRegistry
  ) {}

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
