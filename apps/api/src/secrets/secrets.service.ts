import type {
  EnvImportInput,
  SecretCreateInput,
  SecretListQuery,
  SecretUpdateInput,
  SecretValueUpsertInput,
} from '@aegis/shared';
import { Types, type ClientSession, type Connection, type Model } from 'mongoose';
import { currentAuditContext } from '../audit/audit-context';
import type { AuditService } from '../audit/audit.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../common/http-error';
import { EnvelopeCipherService, type EnvelopeCipherRecord } from '../crypto/envelope-cipher.service';
import { valueAad } from '../crypto/value-cipher.service';
import { withTransaction } from '../database/transaction';
import { ProjectAccessService } from '../projects/project-access.service';
import type { WebhookDispatcher } from '../webhooks/webhook-dispatcher';
import { EnvParseError, parseEnvContent } from './env-parser';
import { maskSecretValue } from './secret-mask';
import type {
  SecretExportEntry,
  SecretHistoryView,
  SecretRecord,
  SecretResolveView,
  SecretRollbackView,
  SecretValueRecord,
  SecretView,
} from './types';

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cipherFields(record: EnvelopeCipherRecord): EnvelopeCipherRecord {
  return {
    ciphertext: record.ciphertext,
    iv: record.iv,
    authTag: record.authTag,
    wrappedDek: record.wrappedDek,
    dekIv: record.dekIv,
    dekAuthTag: record.dekAuthTag,
    keyId: record.keyId,
    cipherVersion: record.cipherVersion,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export class SecretsService {
  constructor(
    private readonly secrets: Model<SecretRecord>,
    private readonly secretValues: Model<SecretValueRecord>,
    private readonly secretHistory: Model<any>,
    private readonly connection: Connection,
    private readonly access: ProjectAccessService,
    private readonly cipher: EnvelopeCipherService,
    private readonly audits: AuditService,
    private readonly webhooks?: WebhookDispatcher
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
      const version = await this.writeEncryptedValue(
        workspaceId,
        String(created._id),
        input.environmentId,
        encrypted,
        userId,
        session
      );
      await this.recordValueAudit(
        workspaceId,
        projectId,
        String(created._id),
        input.environmentId,
        version,
        'secrets.value.create',
        userId,
        session
      );
      return created;
    });
    await this.emit(String(secret._id), workspaceId, projectId, 'secret.created');
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
      if (input.value === undefined) {
        await this.emit(secretId, workspaceId, projectId, 'secret.updated');
      }
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
    await this.storeValue(workspaceId, projectId, environmentId, String(secret._id), input.value, userId);
    await this.emit(secretId, workspaceId, projectId, 'secret.updated');
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
    await this.emit(secretId, workspaceId, projectId, 'secret.deleted');
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
          userId,
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

  async resolve(
    workspaceId: string,
    projectId: string,
    environmentId: string,
    names?: string[]
  ): Promise<SecretResolveView> {
    await this.access.requireEnvironmentScope(workspaceId, projectId, environmentId);
    const secrets = await this.secrets
      .find({ workspaceId: objectId(workspaceId), projectId: objectId(projectId) })
      .exec();
    const allowed = names ? secrets.filter((secret) => names.includes(secret.name)) : secrets;
    if (allowed.length === 0) {
      return { entries: [] };
    }
    const values = await this.secretValues
      .find({
        workspaceId: objectId(workspaceId),
        environmentId: objectId(environmentId),
        secretId: { $in: allowed.map((secret) => secret._id) },
      })
      .exec();
    const nameById = new Map(allowed.map((secret) => [String(secret._id), secret.name]));
    const entries: SecretExportEntry[] = [];
    for (const value of values) {
      const name = nameById.get(String(value.secretId));
      if (!name) {
        continue;
      }
      entries.push({
        name,
        value: await this.cipher.decrypt(
          value,
          valueAad(workspaceId, projectId, environmentId, String(value.secretId))
        ),
      });
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    return { entries };
  }

  async validate(workspaceId: string, projectId: string, environmentId: string): Promise<void> {
    await this.access.requireEnvironmentScope(workspaceId, projectId, environmentId);
  }

  async history(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    environmentId: string,
    limit = 50
  ): Promise<SecretHistoryView[]> {
    await this.requireAccess(userId, workspaceId, projectId);
    await this.findSecret(workspaceId, projectId, secretId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    const history = await this.secretHistory
      .find({
        workspaceId: objectId(workspaceId),
        secretId: objectId(secretId),
        environmentId: objectId(environmentId),
      })
      .sort({ valueVersion: -1 })
      .limit(limit)
      .exec();
    return history.map((entry: any) => ({
      version: entry.valueVersion,
      changedBy: entry.changedBy,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date(0).toISOString(),
    }));
  }

  async rollback(
    userId: string,
    workspaceId: string,
    projectId: string,
    secretId: string,
    environmentId: string,
    version: number,
    confirmation: string
  ): Promise<SecretRollbackView> {
    if (confirmation !== 'ROLLBACK') {
      throw new BadRequestException('Confirmation must be ROLLBACK');
    }
    await this.requireAccess(userId, workspaceId, projectId);
    const secret = await this.findSecret(workspaceId, projectId, secretId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    return withTransaction(this.connection, async (session) => {
      const entry = await this.secretHistory
        .findOne({
          workspaceId: objectId(workspaceId),
          secretId: objectId(secretId),
          environmentId: objectId(environmentId),
          valueVersion: version,
        })
        .exec();
      if (!entry) {
        throw new NotFoundException('Secret version not found');
      }
      const encrypted: EnvelopeCipherRecord = {
        ciphertext: entry.ciphertext,
        iv: entry.iv,
        authTag: entry.authTag,
        wrappedDek: entry.wrappedDek,
        dekIv: entry.dekIv,
        dekAuthTag: entry.dekAuthTag,
        keyId: entry.keyId,
        cipherVersion: entry.cipherVersion,
      };
      const valueVersion = await this.writeEncryptedValue(
        workspaceId,
        secretId,
        environmentId,
        encrypted,
        userId,
        session
      );
      await this.recordValueAudit(
        workspaceId,
        projectId,
        secretId,
        environmentId,
        valueVersion,
        'secrets.rollback',
        userId,
        session
      );
      return { id: String(secret._id), name: secret.name, version: valueVersion };
    });
  }

  private async emit(
    secretId: string,
    workspaceId: string,
    projectId: string,
    event: 'secret.created' | 'secret.updated' | 'secret.deleted'
  ): Promise<void> {
    if (!this.webhooks) {
      return;
    }
    await this.webhooks.dispatch(workspaceId, projectId, event, { secretId });
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
    changedBy: string,
    session?: ClientSession
  ): Promise<number> {
    const encrypted = await this.encryptValue(workspaceId, projectId, environmentId, secretId, value);
    return this.writeEncryptedValue(workspaceId, secretId, environmentId, encrypted, changedBy, session);
  }

  private async writeEncryptedValue(
    workspaceId: string,
    secretId: string,
    environmentId: string,
    encrypted: EnvelopeCipherRecord,
    changedBy: string,
    session?: ClientSession
  ): Promise<number> {
    const filter = {
      workspaceId: objectId(workspaceId),
      secretId: objectId(secretId),
      environmentId: objectId(environmentId),
    };
    const updated = await this.secretValues
      .findOneAndUpdate(filter, { $inc: { valueVersion: 1 }, $set: cipherFields(encrypted) }, { new: true, session })
      .exec();
    if (updated) {
      await this.writeHistory(workspaceId, secretId, environmentId, encrypted, updated.valueVersion, changedBy, session);
      return updated.valueVersion;
    }
    try {
      await this.secretValues.create(
        {
          ...filter,
          ...cipherFields(encrypted),
          valueVersion: 1,
        },
        { session }
      );
      await this.writeHistory(workspaceId, secretId, environmentId, encrypted, 1, changedBy, session);
      return 1;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const retried = await this.secretValues
        .findOneAndUpdate(filter, { $inc: { valueVersion: 1 }, $set: cipherFields(encrypted) }, { new: true, session })
        .exec();
      if (!retried) {
        throw error;
      }
      await this.writeHistory(
        workspaceId,
        secretId,
        environmentId,
        encrypted,
        retried.valueVersion,
        changedBy,
        session
      );
      return retried.valueVersion;
    }
  }

  private async writeHistory(
    workspaceId: string,
    secretId: string,
    environmentId: string,
    encrypted: EnvelopeCipherRecord,
    valueVersion: number,
    changedBy: string,
    session?: ClientSession
  ): Promise<void> {
    await this.secretHistory.create(
      [
        {
          workspaceId: objectId(workspaceId),
          secretId: objectId(secretId),
          environmentId: objectId(environmentId),
          ...cipherFields(encrypted),
          valueVersion,
          changedBy,
        },
      ],
      { session }
    );
  }

  private async recordValueAudit(
    workspaceId: string,
    projectId: string,
    secretId: string,
    environmentId: string,
    valueVersion: number,
    action: string,
    userId: string,
    session?: ClientSession
  ): Promise<void> {
    await this.audits.record(
      {
        workspaceId,
        projectId,
        action,
        metadata: { secretId, environmentId, valueVersion },
        actor: currentAuditContext() ?? { actorType: 'USER', actorId: userId },
      },
      session
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
