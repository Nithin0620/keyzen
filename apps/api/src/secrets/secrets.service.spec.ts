import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvelopeCipherService } from '../crypto/envelope-cipher.service';
import { EnvKeyProvider } from '../crypto/env-key.provider';
import { KeyProviderRegistry } from '../crypto/key-provider.registry';
import { ValueCipherService, valueAad } from '../crypto/value-cipher.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { KeyRotationService } from './key-rotation.service';
import { SecretsService } from './secrets.service';

const FIRST_MASTER = Buffer.alloc(32, 11).toString('base64');
const SECOND_MASTER = Buffer.alloc(32, 22).toString('base64');

class Query<T> {
  constructor(private readonly run: () => Promise<T>) {}

  sort(): this {
    return this;
  }

  limit(_count: number): this {
    return this;
  }

  exec(): Promise<T> {
    return this.run();
  }
}

function matches(doc: Record<string, any>, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected === undefined) {
      return true;
    }
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.some((item: unknown) => String(item) === String(actual));
    }
    if (expected && typeof expected === 'object' && '$regex' in expected) {
      return new RegExp(expected.$regex, expected.$options).test(String(actual));
    }
    if (expected instanceof Types.ObjectId || actual instanceof Types.ObjectId) {
      return String(actual) === String(expected);
    }
    return actual === expected;
  });
}

class FakeModel {
  readonly docs: Array<Record<string, any>> = [];

  find(filter: Record<string, any> = {}): Query<any[]> {
    return new Query(async () => this.docs.filter((doc) => matches(doc, filter)));
  }

  findOne(filter: Record<string, any>): Query<any> {
    return new Query(async () => this.docs.find((doc) => matches(doc, filter)) ?? null);
  }

  findById(id: unknown): Query<any> {
    return new Query(async () => this.docs.find((doc) => String(doc._id) === String(id)) ?? null);
  }

  create(input: Record<string, any> | Record<string, any>[], _options?: unknown): Promise<any> {
    if (Array.isArray(input)) {
      const created = input.map((doc) => ({ _id: new Types.ObjectId(), ...doc }));
      this.docs.push(...created);
      return Promise.resolve(created);
    }
    const created = { _id: new Types.ObjectId(), ...input };
    this.docs.push(created);
    return Promise.resolve(created);
  }

  updateOne(filter: Record<string, any>, update: Record<string, any>, _options?: unknown): Promise<any> {
    const doc = this.docs.find((item) => matches(item, filter));
    if (!doc) {
      return Promise.resolve({ modifiedCount: 0 });
    }
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    return Promise.resolve({ modifiedCount: 1 });
  }

  deleteOne(filter: Record<string, any>, _options?: unknown): Promise<any> {
    const index = this.docs.findIndex((doc) => matches(doc, filter));
    if (index === -1) {
      return Promise.resolve({ deletedCount: 0 });
    }
    this.docs.splice(index, 1);
    return Promise.resolve({ deletedCount: 1 });
  }

  deleteMany(filter: Record<string, any>, _options?: unknown): Promise<any> {
    const before = this.docs.length;
    this.docs.splice(0, this.docs.length, ...this.docs.filter((doc) => !matches(doc, filter)));
    return Promise.resolve({ deletedCount: before - this.docs.length });
  }
}

describe('SecretsService', () => {
  const workspaceId = new Types.ObjectId();
  const projectId = new Types.ObjectId();
  const environmentId = new Types.ObjectId();
  const otherEnvironmentId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  let users: FakeModel;
  let workspaceMembers: FakeModel;
  let projects: FakeModel;
  let projectMembers: FakeModel;
  let environments: FakeModel;
  let secrets: FakeModel;
  let secretValues: FakeModel;
  let secretHistory: FakeModel;
  let access: ProjectAccessService;
  let cipher: EnvelopeCipherService;
  let registry: KeyProviderRegistry;
  let service: SecretsService;
  let rotation: KeyRotationService;

  function fakeConnection(): any {
    const session = {
      withTransaction: vi.fn(async (work: (session: unknown) => Promise<void>) => {
        await work(session);
      }),
      endSession: vi.fn(async () => undefined),
    };
    return { startSession: vi.fn(async () => session) };
  }

  beforeEach(() => {
    users = new FakeModel();
    workspaceMembers = new FakeModel();
    projects = new FakeModel();
    projectMembers = new FakeModel();
    environments = new FakeModel();
    secrets = new FakeModel();
    secretValues = new FakeModel();
    secretHistory = new FakeModel();
    users.docs.push({ _id: userId, status: 'ACTIVE' });
    workspaceMembers.docs.push({ workspaceId, userId, role: 'OWNER' });
    projects.docs.push({ _id: projectId, workspaceId, archivedAt: null });
    projectMembers.docs.push({ projectId, workspaceId, userId, role: 'OWNER', customPermissions: [] });
    environments.docs.push(
      { _id: environmentId, projectId, workspaceId, archivedAt: null },
      { _id: otherEnvironmentId, projectId, workspaceId, archivedAt: null }
    );
    access = new ProjectAccessService(
      users as any,
      workspaceMembers as any,
      projects as any,
      projectMembers as any,
      environments as any
    );
    registry = new KeyProviderRegistry([
      new EnvKeyProvider(FIRST_MASTER),
      new EnvKeyProvider(SECOND_MASTER, 'env-master-v2'),
    ]);
    cipher = new EnvelopeCipherService(registry, new ValueCipherService(FIRST_MASTER));
    service = new SecretsService(
      secrets as any,
      secretValues as any,
      secretHistory as any,
      fakeConnection(),
      access,
      cipher
    );
    rotation = new KeyRotationService(secrets as any, secretValues as any, access, cipher, registry);
  });

  it('creates, searches by name, masks, reveals, updates and deletes with typed confirmation', async () => {
    const created = await service.create(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      name: 'API_KEY',
      value: 'super-secret-value',
    });
    expect(created.value?.masked).not.toContain('super-secret-value');

    const listed = await service.list(String(userId), String(workspaceId), String(projectId), {
      query: 'API',
      limit: 50,
    });
    expect(listed).toHaveLength(1);
    const withValues = await service.list(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      limit: 50,
    });
    expect(JSON.stringify(withValues)).not.toContain('super-secret-value');

    const revealed = await service.reveal(
      String(userId),
      String(workspaceId),
      String(projectId),
      created.id,
      String(environmentId)
    );
    expect(revealed.value).toBe('super-secret-value');
    expect(JSON.stringify(secretValues.docs[0])).not.toContain('super-secret-value');

    await service.update(String(userId), String(workspaceId), String(projectId), created.id, {
      description: 'primary key',
      value: 'rotated-value',
      environmentId: String(environmentId),
    });
    expect(secretValues.docs[0].valueVersion).toBe(2);
    expect(
      (await service.reveal(String(userId), String(workspaceId), String(projectId), created.id, String(environmentId))).value
    ).toBe('rotated-value');

    await expect(
      service.remove(String(userId), String(workspaceId), String(projectId), created.id, 'wrong')
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.remove(String(userId), String(workspaceId), String(projectId), created.id, 'API_KEY');
    expect(secrets.docs).toHaveLength(0);
    expect(secretValues.docs).toHaveLength(0);
  });

  it('enforces duplicate names, explicit project membership and tenant boundaries', async () => {
    await service.create(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      name: 'API_KEY',
      value: 'value-one',
    });
    await expect(
      service.create(String(userId), String(workspaceId), String(projectId), {
        environmentId: String(environmentId),
        name: 'API_KEY',
        value: 'value-two',
      })
    ).rejects.toBeInstanceOf(ConflictException);

    const otherWorkspaceId = new Types.ObjectId();
    workspaceMembers.docs.push({ workspaceId: otherWorkspaceId, userId, role: 'OWNER' });
    await expect(
      service.create(String(userId), String(otherWorkspaceId), String(projectId), {
        environmentId: String(environmentId),
        name: 'OTHER_KEY',
        value: 'value-three',
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    projectMembers.docs.splice(0, 1);
    await expect(
      service.list(String(userId), String(workspaceId), String(projectId), { limit: 50 })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('imports .env content with limits and exports plaintext only to the caller', async () => {
    const result = await service.import(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      contents: 'API_KEY="secret-one"\nDATABASE_URL=secret-two\n',
    });
    expect(result.imported).toBe(2);
    expect(JSON.stringify(secrets.docs)).toContain('API_KEY');
    expect(JSON.stringify(secretValues.docs)).not.toContain('secret-one');
    expect(JSON.stringify(secretValues.docs)).not.toContain('secret-two');

    const exported = await service.export(String(userId), String(workspaceId), String(projectId), String(environmentId));
    expect(exported.entries).toEqual([
      { name: 'API_KEY', value: 'secret-one' },
      { name: 'DATABASE_URL', value: 'secret-two' },
    ]);

    await expect(
      service.import(String(userId), String(workspaceId), String(projectId), {
        environmentId: String(environmentId),
        contents: 'BAD LINE',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when a ciphertext is moved to another secret or environment', async () => {
    await service.create(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      name: 'API_KEY',
      value: 'bound-value',
    });
    const second = await service.create(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      name: 'SECOND_KEY',
      value: 'other-value',
    });
    const stored = secretValues.docs[0];
    secretValues.docs[1] = { ...stored, secretId: new Types.ObjectId(second.id) };
    await expect(
      service.reveal(String(userId), String(workspaceId), String(projectId), second.id, String(environmentId))
    ).rejects.toThrow();
  });

  it('re-encrypts legacy and envelope values on key rotation without data loss', async () => {
    const legacySecretId = new Types.ObjectId();
    secrets.docs.push({ _id: legacySecretId, projectId, workspaceId, name: 'LEGACY_KEY' });
    const legacy = new ValueCipherService(FIRST_MASTER).encrypt(
      'legacy-value',
      valueAad(String(workspaceId), String(projectId), String(environmentId), String(legacySecretId))
    );
    secretValues.docs.push({
      secretId: legacySecretId,
      environmentId,
      workspaceId,
      valueVersion: 1,
      ...legacy,
    });

    const created = await service.create(String(userId), String(workspaceId), String(projectId), {
      environmentId: String(environmentId),
      name: 'API_KEY',
      value: 'envelope-value',
    });
    const result = await rotation.rotateProjectKeys(
      String(userId),
      String(workspaceId),
      String(projectId),
      'env-master-v2'
    );
    expect(result.rotated).toBe(2);
    expect(secretValues.docs.every((value) => value.keyId === 'env-master-v2' && value.cipherVersion === 2)).toBe(true);
    expect(secretValues.docs.every((value) => Boolean(value.wrappedDek))).toBe(true);
    expect(
      (await service.reveal(String(userId), String(workspaceId), String(projectId), created.id, String(environmentId))).value
    ).toBe('envelope-value');
    expect(
      await cipher.decrypt(
        secretValues.docs[0] as any,
        valueAad(String(workspaceId), String(projectId), String(environmentId), String(legacySecretId))
      )
    ).toBe('legacy-value');
  });
});
