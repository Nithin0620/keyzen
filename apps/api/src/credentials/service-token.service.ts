import type { ServiceTokenCreatedView, ServiceTokenInput, ServiceTokenView } from '@aegis/shared';
import { Types, type Model } from 'mongoose';
import { NotFoundException, UnauthorizedException } from '../common/http-error';
import { hashToken, randomToken } from '../common/tokens';
import { ProjectAccessService } from '../projects/project-access.service';
import type { RevocationCache } from './revocation-cache';

export interface ServiceTokenIdentity {
  id: string;
  workspaceId: string;
  projectId: string;
  environmentId: string;
  expiresAt: string;
}

export interface ServiceTokenRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  environmentId: Types.ObjectId;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  createdBy: Types.ObjectId;
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
}

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

function newToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const raw = randomToken(32);
  return {
    token: `ags_${raw}`,
    tokenHash: hashToken(`ags_${raw}`),
    tokenPrefix: `ags_${raw.slice(0, 8)}`,
  };
}

function expiryDate(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function ttlSeconds(expiresAt: Date): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export class ServiceTokenService {
  constructor(
    private readonly tokens: Model<ServiceTokenRecord>,
    private readonly access: ProjectAccessService,
    private readonly revocations: RevocationCache
  ) {}

  async authenticate(token: string): Promise<ServiceTokenIdentity> {
    if (!token.startsWith('ags_')) {
      throw new UnauthorizedException();
    }
    const tokenHash = hashToken(token);
    try {
      if (await this.revocations.isRevoked(tokenHash)) {
        throw new UnauthorizedException();
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException();
    }
    const record = await this.tokens
      .findOne({ tokenHash, status: 'ACTIVE', expiresAt: { $gt: new Date() } })
      .exec();
    if (!record) {
      throw new UnauthorizedException();
    }
    await this.tokens.updateOne({ _id: record._id }, { $set: { lastUsedAt: new Date() } });
    return {
      id: String(record._id),
      workspaceId: String(record.workspaceId),
      projectId: String(record.projectId),
      environmentId: String(record.environmentId),
      expiresAt: new Date(record.expiresAt).toISOString(),
    };
  }

  async create(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: ServiceTokenInput
  ): Promise<ServiceTokenCreatedView> {
    await this.requireAccess(userId, workspaceId, projectId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, input.environmentId);
    const generated = newToken();
    const [created] = await this.tokens.create([
      {
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
        environmentId: objectId(input.environmentId),
        name: input.name,
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
        createdBy: objectId(userId),
        status: 'ACTIVE',
        expiresAt: expiryDate(input.expiresInDays),
      },
    ]);
    return { ...this.view(created), token: generated.token };
  }

  async list(userId: string, workspaceId: string, projectId: string): Promise<ServiceTokenView[]> {
    await this.requireAccess(userId, workspaceId, projectId);
    const records = await this.tokens
      .find({ workspaceId: objectId(workspaceId), projectId: objectId(projectId) })
      .sort({ createdAt: -1 })
      .exec();
    return records.map((record) => this.view(record));
  }

  async rotate(
    userId: string,
    workspaceId: string,
    projectId: string,
    tokenId: string,
    expiresInDays: number
  ): Promise<ServiceTokenCreatedView> {
    await this.requireAccess(userId, workspaceId, projectId);
    const record = await this.findScoped(workspaceId, projectId, tokenId);
    if (record.status === 'REVOKED') {
      throw new NotFoundException();
    }
    const generated = newToken();
    await this.revocations.revoke(record.tokenHash, ttlSeconds(record.expiresAt));
    const updated = await this.tokens
      .findOneAndUpdate(
        { _id: record._id, workspaceId: objectId(workspaceId), projectId: objectId(projectId) },
        {
          $set: {
            tokenHash: generated.tokenHash,
            tokenPrefix: generated.tokenPrefix,
            expiresAt: expiryDate(expiresInDays),
            lastUsedAt: null,
          },
        },
        { new: true }
      )
      .exec();
    if (!updated) {
      throw new NotFoundException();
    }
    return { ...this.view(updated), token: generated.token };
  }

  async revoke(userId: string, workspaceId: string, projectId: string, tokenId: string): Promise<ServiceTokenView> {
    await this.requireAccess(userId, workspaceId, projectId);
    const record = await this.findScoped(workspaceId, projectId, tokenId);
    if (record.status !== 'REVOKED') {
      await this.revocations.revoke(record.tokenHash, ttlSeconds(record.expiresAt));
      const updated = await this.tokens
        .findOneAndUpdate(
          { _id: record._id, workspaceId: objectId(workspaceId), projectId: objectId(projectId) },
          { $set: { status: 'REVOKED', revokedAt: new Date() } },
          { new: true }
        )
        .exec();
      if (!updated) {
        throw new NotFoundException();
      }
      return this.view(updated);
    }
    return this.view(record);
  }

  private async requireAccess(userId: string, workspaceId: string, projectId: string): Promise<void> {
    await this.access.requireActiveProject(userId, workspaceId, projectId);
    await this.access.requireProjectMember(userId, workspaceId, projectId);
  }

  private async findScoped(
    workspaceId: string,
    projectId: string,
    tokenId: string
  ): Promise<ServiceTokenRecord> {
    const record = await this.tokens
      .findOne({
        _id: objectId(tokenId),
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
      })
      .exec();
    if (!record) {
      throw new NotFoundException();
    }
    return record;
  }

  private view(record: ServiceTokenRecord): ServiceTokenView {
    const expired = new Date(record.expiresAt).getTime() <= Date.now();
    return {
      id: String(record._id),
      name: record.name,
      tokenPrefix: record.tokenPrefix,
      environmentId: String(record.environmentId),
      status: record.status === 'REVOKED' ? 'REVOKED' : expired ? 'EXPIRED' : 'ACTIVE',
      expiresAt: new Date(record.expiresAt).toISOString(),
      lastUsedAt: iso(record.lastUsedAt),
      revokedAt: iso(record.revokedAt),
    };
  }
}
