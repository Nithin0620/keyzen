import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '../common/http-error';
import { hashToken } from '../common/tokens';
import { InMemoryRevocationCache } from './revocation-cache';
import { ServiceTokenService, type ServiceTokenRecord } from './service-token.service';

const userId = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const projectId = new Types.ObjectId();
const environmentId = new Types.ObjectId();

function record(overrides: Partial<ServiceTokenRecord> = {}): ServiceTokenRecord {
  return {
    _id: new Types.ObjectId(),
    workspaceId,
    projectId,
    environmentId,
    name: 'deploy',
    tokenHash: hashToken('ags_existing-token'),
    tokenPrefix: 'ags_existing',
    createdBy: userId,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 86_400_000),
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function query<T>(value: T): any {
  return {
    sort() {
      return this;
    },
    exec: vi.fn(async () => value),
  };
}

describe('ServiceTokenService', () => {
  let tokens: any;
  let access: any;
  let revocations: InMemoryRevocationCache;
  let service: ServiceTokenService;

  beforeEach(() => {
    tokens = {
      create: vi.fn(async (docs: any[]) => docs.map((doc) => ({ _id: new Types.ObjectId(), ...doc }))),
      find: vi.fn(() => query([])),
      findOne: vi.fn(() => query(null)),
      findOneAndUpdate: vi.fn(() => query(null)),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    };
    access = {
      requireActiveProject: vi.fn(async () => undefined),
      requireProjectMember: vi.fn(async () => undefined),
      requireEnvironment: vi.fn(async () => undefined),
    };
    revocations = new InMemoryRevocationCache();
    service = new ServiceTokenService(tokens, access, revocations);
  });

  it('stores only a hash and reveals plaintext once on creation', async () => {
    const created = await service.create(String(userId), String(workspaceId), String(projectId), {
      name: 'deploy',
      environmentId: String(environmentId),
      expiresInDays: 30,
    });
    const stored = tokens.create.mock.calls[0][0][0];
    expect(created.token).toMatch(/^ags_/);
    expect(created.tokenPrefix).toBe(created.token.slice(0, 12));
    expect(stored.tokenHash).toBe(hashToken(created.token));
    expect(stored.token).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain(created.token);
    expect(access.requireEnvironment).toHaveBeenCalledWith(
      String(userId),
      String(workspaceId),
      String(projectId),
      String(environmentId)
    );
  });

  it('rejects revoked or unknown tokens without exposing token state', async () => {
    const token = 'ags_existing-token';
    const existing = record();
    tokens.findOne.mockReturnValue(query(existing));
    await revocations.revoke(hashToken(token), 60);

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.findOne).not.toHaveBeenCalled();

    revocations = new InMemoryRevocationCache();
    const cacheError = { isRevoked: vi.fn(async () => Promise.reject(new Error('redis down'))) };
    service = new ServiceTokenService(tokens, access, cacheError as any);
    await expect(service.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authenticates active tokens and updates lastUsedAt without returning the hash', async () => {
    const token = 'ags_existing-token';
    const existing = record();
    tokens.findOne.mockReturnValue(query(existing));

    const identity = await service.authenticate(token);

    expect(identity.id).toBe(String(existing._id));
    expect(identity.environmentId).toBe(String(environmentId));
    expect(identity.expiresAt).toBe(existing.expiresAt.toISOString());
    expect(JSON.stringify(identity)).not.toContain(existing.tokenHash);
    expect(tokens.updateOne).toHaveBeenCalledWith({ _id: existing._id }, { $set: { lastUsedAt: expect.any(Date) } });
  });

  it('caches revoked hashes immediately on revoke and rotate', async () => {
    const existing = record();
    tokens.findOne.mockReturnValue(query(existing));
    tokens.findOneAndUpdate.mockReturnValue(
      query(
        record({
          status: 'REVOKED',
          revokedAt: new Date(),
          tokenHash: existing.tokenHash,
          tokenPrefix: existing.tokenPrefix,
        })
      )
    );

    const revoked = await service.revoke(String(userId), String(workspaceId), String(projectId), String(existing._id));
    expect(revoked.status).toBe('REVOKED');
    expect(JSON.stringify(revoked)).not.toContain(existing.tokenHash);
    expect(await revocations.isRevoked(existing.tokenHash)).toBe(true);

    const updated = record({ tokenHash: hashToken('ags_rotation-token'), tokenPrefix: 'ags_rotat' });
    tokens.findOne.mockReturnValue(query(updated));
    tokens.findOneAndUpdate.mockReturnValue(query(updated));
    const rotated = await service.rotate(
      String(userId),
      String(workspaceId),
      String(projectId),
      String(updated._id),
      14
    );
    expect(rotated.token).toMatch(/^ags_/);
    expect(await revocations.isRevoked(updated.tokenHash)).toBe(true);
  });

  it('lists prefixes and statuses without token hashes', async () => {
    tokens.find.mockReturnValue(
      query([
        record({ tokenHash: hashToken('ags_visible-token'), tokenPrefix: 'ags_visib' }),
        record({
          status: 'REVOKED',
          revokedAt: new Date(),
          tokenHash: hashToken('ags_revoked-token'),
          tokenPrefix: 'ags_revok',
        }),
      ])
    );

    const listed = await service.list(String(userId), String(workspaceId), String(projectId));
    expect(listed.map((token) => token.tokenPrefix)).toEqual(['ags_visib', 'ags_revok']);
    expect(listed.map((token) => token.status)).toEqual(['ACTIVE', 'REVOKED']);
    expect(JSON.stringify(listed)).not.toContain('tokenHash');
  });
});
