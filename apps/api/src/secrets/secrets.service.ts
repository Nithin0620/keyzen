import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type {
  EnvImportInput,
  SecretCreateInput,
  SecretListQuery,
  SecretUpdateInput,
  SecretValueUpsertInput,
} from '@aegis/shared';
import { Types, type ClientSession, type Connection, type Model } from 'mongoose';
import { EnvelopeCipherService } from '../crypto/envelope-cipher.service';
import { valueAad } from '../crypto/value-cipher.service';
import { SECRET_HISTORY_MODEL, SECRET_MODEL, SECRET_VALUE_MODEL } from '../database/schemas';
import { withTransaction } from '../database/transaction';
import { ProjectAccessService } from '../projects/project-access.service';
import { EnvParseError, parseEnvContent } from './env-parser';
import { maskSecretValue } from './secret-mask';
import type { SecretExportEntry, SecretRecord, SecretValueRecord, SecretView } from './types';

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class SecretsService {
  constructor(
    @InjectModel(SECRET_MODEL) private readonly secrets: Model<SecretRecord>,
    @InjectModel(SECRET_VALUE_MODEL) private readonly secretValues: Model<SecretValueRecord>,
    @InjectModel(SECRET_HISTORY_MODEL) private readonly secretHistory: Model<any>,
    @InjectConnection() private readonly connection: Connection,
    private readonly access: ProjectAccessService,
    private readonly cipher: EnvelopeCipherService
  ) {}

  async create(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: SecretCreateInput
  ): Promise<SecretView> {
    await this.requireAccess(userId, workspaceId, projectId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, input.environmentId);
    const existing = await this.secrets
      .findOne({ workspaceId: objectId(workspaceId), projectId: objectId(projectId), name: input.name })
      .exec();
    if (existing) {
      throw new ConflictException('Secret name already in use');
    }
    const secret = await withTransaction(this.connection, async (session) => {
      const [created] = await this.secrets.create(
        [
          {
            workspaceId: objectId(workspaceId),
            projectId: objectId(projectId),
            name: input.name,
            description: input.description,
          },
        ],
        { session }
      );
      const encrypted = await this.encryptValue(
        workspaceId,
        projectId,
        input.environmentId,
        String(created._id),
        input.value
      );
      await this.secretValues.create(
        {
          secretId: created._id,
          environmentId: objectId(input.environmentId),
          workspaceId: objectId(workspaceId),
          ...encrypted,
          valueVersion: 1,
        },
        { session }
      );
      return created;
    });
    return this.view(secret, input.value);
  }

  async list(
    userId: string,
    workspaceId: string,
    projectId: string,
    query: SecretListQuery
  ): Promise<SecretView[]> {
    await this.requireAccess(userId, workspaceId, projectId);
    const filter: Record<string, unknown> = {
      workspaceId: objectId(workspaceId),
      projectId: objectId(projectId),
    };
    if (query.query) {
      filter.name = { $regex: escapeRegex(query.query), $options: 'i' };
    }
    const secrets = await this.secrets.find(filter).sort({ name: 1 }).limit(query.limit).exec();
    if (secrets.length === 0) {
      return [];
    }
    const valuesBySecret = new Map<string, SecretValueRecord>();
    if (query.environmentId) {
      await this.access.requireEnvironment(userId, workspaceId, projectId, query.environmentId);
      const values = await this.secretValues
        .find({
          workspaceId: objectId(workspaceId),
          environmentId: objectId(query.environmentId),
          secretId: { $in: secrets.map((secret) => secret._id) },
        })
        .exec();
      for (const value of values) {
        valuesBySecret.set(String(value.secretId), value);
      }
    }
    return Promise.all(
      secrets.map(async (secret) => {
        const encrypted = valuesBySecret.get(String(secret._id));
        if (!encrypted || !query.environmentId) {
          return this.view(secret, undefined, null);
        }
        const plaintext = await this.cipher.decrypt(
          encrypted,
          valueAad(workspaceId, projectId, query.environmentId, String(secret._id))
        );
        return this.view(secret, undefined, maskSecretValue(plaintext));
      })
    );
  }

  async get(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    environmentId?: string
  ): Promise<SecretView> {
    await this.requireAccess(userId, workspaceId, projectId);
    const secret = await this.findSecret(workspaceId, projectId, secretId);
    if (!environmentId) {
      return this.view(secret);
    }
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    const value = await this.findValue(workspaceId, secretId, environmentId);
    if (!value) {
      return this.view(secret, undefined, null);
    }
    const plaintext = await this.cipher.decrypt(
      value,
      valueAad(workspaceId, projectId, environmentId, secretId)
    );
    return this.view(secret, undefined, maskSecretValue(plaintext));
  }

  async reveal(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    environmentId: string
  ): Promise<{ name: string; value: string }> {
    await this.requireAccess(userId, workspaceId, projectId);
    const secret = await this.findSecret(workspaceId, projectId, secretId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    const value = await this.findValue(workspaceId, secretId, environmentId);
    if (!value) {
      throw new NotFoundException();
    }
    const plaintext = await this.cipher.decrypt(
      value,
      valueAad(workspaceId, projectId, environmentId, secretId)
    );
    return { name: secret.name, value: plaintext };
  }

  async update(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    input: SecretUpdateInput
  ): Promise<SecretView> {
    await this.requireAccess(userId, workspaceId, projectId);
    const secret = await this.findSecret(workspaceId, projectId, secretId);
    if (input.name && input.name !== secret.name) {
      const conflict = await this.secrets
        .findOne({
          workspaceId: objectId(workspaceId),
          projectId: objectId(projectId),
          name: input.name,
        })
        .exec();
      if (conflict) {
        throw new ConflictException('Secret name already in use');
      }
    }
    const metadata: Record<string, unknown> = {};
    if (input.name) {
      metadata.name = input.name;
    }
    if (input.description !== undefined) {
      metadata.description = input.description;
    }
    if (Object.keys(metadata).length > 0) {
      await this.secrets.updateOne({ _id: secret._id }, { $set: metadata });
    }
    if (input.value !== undefined && input.environmentId) {
      await this.access.requireEnvironment(userId, workspaceId, projectId, input.environmentId);
      await this.upsertValue(
        userId,
        workspaceId,
        projectId,
        String(secret._id),
        input.environmentId,
        { value: input.value }
      );
    }
    return this.get(userId, workspaceId, projectId, secretId, input.environmentId);
  }

  async upsertValue(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    environmentId: string,
    input: SecretValueUpsertInput
  ): Promise<SecretView> {
    await this.requireAccess(userId, workspaceId, projectId);
    const secret = await this.findSecret(workspaceId, projectId, secretId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    await this.storeValue(workspaceId, projectId, environmentId, String(secret._id), input.value);
    return this.get(userId, workspaceId, projectId, secretId, environmentId);
  }

  async remove(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    confirmation: string
  ): Promise<void> {
    await this.requireAccess(userId, workspaceId, projectId);
    const secret = await this.findSecret(workspaceId, projectId, secretId);
    if (confirmation !== secret.name) {
      throw new BadRequestException('Confirmation does not match secret name');
    }
    await withTransaction(this.connection, async (session) => {
      await this.secretValues.deleteMany({ secretId: secret._id, workspaceId: objectId(workspaceId) }, { session });
      await this.secretHistory.deleteMany({ secretId: secret._id, workspaceId: objectId(workspaceId) }, { session });
      await this.secrets.deleteOne({ _id: secret._id }, { session });
    });
  }

  async import(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: EnvImportInput
  ): Promise<{ imported: number }> {
    await this.requireAccess(userId, workspaceId, projectId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, input.environmentId);
    let entries;
    try {
      entries = parseEnvContent(input.contents);
    } catch (error) {
      if (error instanceof EnvParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await withTransaction(this.connection, async (session) => {
      for (const entry of entries) {
        let secret = await this.secrets
          .findOne(
            {
              workspaceId: objectId(workspaceId),
              projectId: objectId(projectId),
              name: entry.name,
            },
            { session }
          )
          .exec();
        if (!secret) {
          const [created] = await this.secrets.create(
            [
              {
                workspaceId: objectId(workspaceId),
                projectId: objectId(projectId),
                name: entry.name,
              },
            ],
            { session }
          );
          secret = created;
        }
        await this.storeValue(
          workspaceId,
          projectId,
          input.environmentId,
          String(secret._id),
          entry.value,
          session
        );
      }
    });
    return { imported: entries.length };
  }

  async export(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<{ entries: SecretExportEntry[] }> {
    await this.requireAccess(userId, workspaceId, projectId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    const secrets = await this.secrets
      .find({ workspaceId: objectId(workspaceId), projectId: objectId(projectId) })
      .exec();
    const values = await this.secretValues
      .find({
        workspaceId: objectId(workspaceId),
        environmentId: objectId(environmentId),
        secretId: { $in: secrets.map((secret) => secret._id) },
      })
      .exec();
    const nameById = new Map(secrets.map((secret) => [String(secret._id), secret.name]));
    const entries: SecretExportEntry[] = [];
    for (const value of values) {
      const name = nameById.get(String(value.secretId));
      if (!name) {
        continue;
      }
      const plaintext = await this.cipher.decrypt(
        value,
        valueAad(workspaceId, projectId, environmentId, String(value.secretId))
      );
      entries.push({ name, value: plaintext });
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    return { entries };
  }

  private async requireAccess(userId: string, workspaceId: string, projectId: string): Promise<void> {
    await this.access.requireActiveProject(userId, workspaceId, projectId);
    await this.access.requireProjectMember(userId, workspaceId, projectId);
  }

  private async findSecret(workspaceId: string, projectId: string, secretId: string): Promise<SecretRecord> {
    const secret = await this.secrets
      .findOne({
        _id: objectId(secretId),
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
      })
      .exec();
    if (!secret) {
      throw new NotFoundException();
    }
    return secret;
  }

  private async findValue(
    workspaceId: string,
    secretId: string,
    environmentId: string
  ): Promise<SecretValueRecord | null> {
    return this.secretValues
      .findOne({
        workspaceId: objectId(workspaceId),
        secretId: objectId(secretId),
        environmentId: objectId(environmentId),
      })
      .exec();
  }

  private async encryptValue(
    workspaceId: string,
    projectId: string,
    environmentId: string,
    secretId: string,
    value: string
  ) {
    return this.cipher.encrypt(value, valueAad(workspaceId, projectId, environmentId, secretId));
  }

  private async storeValue(
    workspaceId: string,
    projectId: string,
    environmentId: string,
    secretId: string,
    value: string,
    session?: ClientSession
  ): Promise<void> {
    const encrypted = await this.encryptValue(workspaceId, projectId, environmentId, secretId, value);
    const existing = await this.secretValues
      .findOne({
        workspaceId: objectId(workspaceId),
        secretId: objectId(secretId),
        environmentId: objectId(environmentId),
      })
      .exec();
    if (existing) {
      await this.secretValues.updateOne(
        { _id: (existing as any)._id },
        { $set: { ...encrypted, valueVersion: existing.valueVersion + 1 } },
        { session }
      );
      return;
    }
    await this.secretValues.create(
      {
        workspaceId: objectId(workspaceId),
        secretId: objectId(secretId),
        environmentId: objectId(environmentId),
        ...encrypted,
        valueVersion: 1,
      },
      { session }
    );
  }

  private view(
    secret: SecretRecord,
    plaintext?: string,
    masked: string | null | undefined = undefined
  ): SecretView {
    const result: SecretView = {
      id: String(secret._id),
      name: secret.name,
      description: secret.description,
    };
    if (plaintext !== undefined) {
      result.value = { present: true, masked: maskSecretValue(plaintext) };
    } else if (masked !== undefined) {
      result.value = { present: masked !== null, masked };
    }
    return result;
  }
}
