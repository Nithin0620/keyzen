import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/http-error';
import { EnvelopeCipherService } from '../crypto/envelope-cipher.service';
import { EnvKeyProvider } from '../crypto/env-key.provider';
import { KeyProviderRegistry } from '../crypto/key-provider.registry';
import { ValueCipherService, valueAad } from '../crypto/value-cipher.service';
import { UnsafeInputError } from '../database/safe-input';
import { ProjectAccessService } from './project-access.service';
import { ProjectsService } from './projects.service';

const MASTER_KEY = Buffer.alloc(32, 7).toString('base64');

class Query<T> {
  constructor(private readonly run: () => Promise<T>) {}

  exec(): Promise<T> {
    return this.run();
  }
}

function matches(doc: Record<string, any>, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.some((item: unknown) => String(item) === String(actual));
    }
    if (expected instanceof Types.ObjectId || actual instanceof Types.ObjectId) {
      return String(actual) === String(expected);
    }
    return actual === expected;
  });
}

function applyUpdate(doc: Record<string, any>, update: Record<string, any>): void {
  if (update.$set) {
    Object.assign(doc, update.$set);
  } else {
    Object.assign(doc, update);
  }
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
    applyUpdate(doc, update);
    return Promise.resolve({ modifiedCount: 1 });
  }

  updateMany(filter: Record<string, any>, update: Record<string, any>, _options?: unknown): Promise<any> {
    let modifiedCount = 0;
    for (const doc of this.docs) {
      if (matches(doc, filter)) {
        applyUpdate(doc, update);
        modifiedCount += 1;
      }
    }
    return Promise.resolve({ modifiedCount });
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

  countDocuments(filter: Record<string, any> = {}): Promise<number> {
    return Promise.resolve(this.docs.filter((doc) => matches(doc, filter)).length);
  }
}

describe('ProjectsService', () => {
  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();
  const ownerId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const memberId = new Types.ObjectId();
  let users: FakeModel;
  let workspaceMembers: FakeModel;
  let projects: FakeModel;
  let projectMembers: FakeModel;
  let environments: FakeModel;
  let secrets: FakeModel;
  let secretValues: FakeModel;
  let secretHistory: FakeModel;
  let serviceTokens: FakeModel;
  let auditLogs: FakeModel;
  let webhooks: FakeModel;
  let service: ProjectsService;
  let cipher: EnvelopeCipherService;

  function fakeConnection(): any {
    const session = {
      withTransaction: vi.fn(async (work: () => Promise<void>) => {
        await work();
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
    serviceTokens = new FakeModel();
    auditLogs = new FakeModel();
    webhooks = new FakeModel();
    cipher = new EnvelopeCipherService(
      new KeyProviderRegistry([new EnvKeyProvider(MASTER_KEY)]),
      new ValueCipherService(MASTER_KEY)
    );

    users.docs.push(
      { _id: ownerId, email: 'owner@example.com', status: 'ACTIVE' },
      { _id: adminId, email: 'admin@example.com', status: 'ACTIVE' },
      { _id: memberId, email: 'member@example.com', status: 'ACTIVE' }
    );
    workspaceMembers.docs.push(
      { _id: new Types.ObjectId(), workspaceId, userId: ownerId, role: 'OWNER' },
      { _id: new Types.ObjectId(), workspaceId, userId: adminId, role: 'MEMBER' },
      { _id: new Types.ObjectId(), workspaceId, userId: memberId, role: 'MEMBER' },
      { _id: new Types.ObjectId(), workspaceId: otherWorkspaceId, userId: ownerId, role: 'OWNER' }
    );

    const access = new ProjectAccessService(
      users as any,
      workspaceMembers as any,
      projects as any,
      projectMembers as any,
      environments as any
    );
    service = new ProjectsService(
      users as any,
      projects as any,
      projectMembers as any,
      environments as any,
      secrets as any,
      secretValues as any,
      secretHistory as any,
      serviceTokens as any,
      auditLogs as any,
      webhooks as any,
      fakeConnection(),
      cipher,
      access
    );
  });

  it('creates projects with a unique workspace slug, archives, restores and hard-deletes with typed confirmation', async () => {
    const project = await service.create(String(ownerId), String(workspaceId), {
      name: 'Payments',
      slug: 'payments',
      settings: { region: 'us' },
    });
    expect(project.slug).toBe('payments');
    expect(project.settings).toEqual({ region: 'us' });
    expect(projectMembers.docs).toHaveLength(1);
    expect(projectMembers.docs[0].role).toBe('OWNER');
    await expect(
      service.create(String(ownerId), String(workspaceId), { name: 'Other', slug: 'payments' })
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(service.update(String(ownerId), String(workspaceId), project.id, { settings: { '$where': 'x' } } as any)).rejects.toBeInstanceOf(UnsafeInputError);
    await service.update(String(ownerId), String(workspaceId), project.id, { name: 'Billing' });
    expect(projects.docs[0].name).toBe('Billing');

    expect((await service.archive(String(ownerId), String(workspaceId), project.id)).archived).toBe(true);
    await expect(service.get(String(ownerId), String(workspaceId), project.id)).rejects.toBeInstanceOf(NotFoundException);
    await service.restore(String(ownerId), String(workspaceId), project.id);
    expect((await service.get(String(ownerId), String(workspaceId), project.id)).archived).toBe(false);

    await expect(service.remove(String(ownerId), String(workspaceId), project.id, 'wrong')).rejects.toBeInstanceOf(BadRequestException);

    const secretId = new Types.ObjectId();
    const environmentId = new Types.ObjectId();
    secrets.docs.push({ _id: secretId, projectId: new Types.ObjectId(project.id), workspaceId, name: 'API_KEY' });
    environments.docs.push({ _id: environmentId, projectId: new Types.ObjectId(project.id), workspaceId, name: 'dev', slug: 'dev', archivedAt: null });
    secretValues.docs.push({ secretId, environmentId, workspaceId, ciphertext: 'x', iv: 'y', authTag: 'z', keyId: 'k', cipherVersion: 1, valueVersion: 1 });
    secretHistory.docs.push({ secretId, environmentId, workspaceId });
    serviceTokens.docs.push({ projectId: new Types.ObjectId(project.id), workspaceId });
    auditLogs.docs.push({ projectId: new Types.ObjectId(project.id), workspaceId });
    webhooks.docs.push({ projectId: new Types.ObjectId(project.id), workspaceId });

    await service.remove(String(ownerId), String(workspaceId), project.id, 'payments');
    for (const model of [projects, projectMembers, environments, secrets, secretValues, secretHistory, serviceTokens, auditLogs, webhooks]) {
      expect(model.docs).toHaveLength(0);
    }
  });

  it('requires explicit project membership for project-level management and guards the last owner', async () => {
    const project = await service.create(String(ownerId), String(workspaceId), { name: 'Payments', slug: 'payments' });
    await expect(
      service.update(String(memberId), String(workspaceId), project.id, { name: 'Nope' })
    ).rejects.toBeInstanceOf(ForbiddenException);

    const admin = await service.addMember(String(ownerId), String(workspaceId), project.id, {
      email: 'admin@example.com',
      role: 'ADMIN',
      customPermissions: [],
    });
    expect(admin.email).toBe('admin@example.com');
    await expect(
      service.addMember(String(ownerId), String(workspaceId), project.id, {
        email: 'admin@example.com',
        role: 'VIEWER',
        customPermissions: [],
      })
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.changeMemberRole(String(ownerId), String(workspaceId), project.id, String(ownerId), { role: 'ADMIN' })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changeMemberRole(String(adminId), String(workspaceId), project.id, String(ownerId), { role: 'ADMIN' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.removeMember(String(ownerId), String(workspaceId), project.id, String(ownerId))
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.addMember(String(ownerId), String(workspaceId), project.id, {
      email: 'member@example.com',
      role: 'OWNER',
      customPermissions: ['secrets.export'],
    });
    await service.changeMemberRole(String(ownerId), String(workspaceId), project.id, String(ownerId), { role: 'ADMIN' });
    await service.removeMember(String(memberId), String(workspaceId), project.id, String(ownerId));
    expect(projectMembers.docs).toHaveLength(2);
  });

  it('returns 404 for cross-workspace project and environment ids', async () => {
    const project = await service.create(String(ownerId), String(workspaceId), { name: 'Payments', slug: 'payments' });
    await expect(service.get(String(ownerId), String(otherWorkspaceId), project.id)).rejects.toBeInstanceOf(NotFoundException);

    const environment = await service.createEnvironment(String(ownerId), String(workspaceId), project.id, {
      name: 'dev',
      slug: 'dev',
    });
    await expect(
      service.getEnvironment(String(ownerId), String(otherWorkspaceId), project.id, environment.id)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getEnvironment(String(ownerId), String(workspaceId), String(new Types.ObjectId()), environment.id)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('duplicates encrypted values under new AAD and returns masked diffs only', async () => {
    const project = await service.create(String(ownerId), String(workspaceId), { name: 'Payments', slug: 'payments' });
    const projectObjectId = new Types.ObjectId(project.id);
    const dev = await service.createEnvironment(String(ownerId), String(workspaceId), project.id, { name: 'dev', slug: 'dev' });
    const prod = await service.createEnvironment(String(ownerId), String(workspaceId), project.id, { name: 'prod', slug: 'prod' });
    const secretId = new Types.ObjectId();
    secrets.docs.push({ _id: secretId, projectId: projectObjectId, workspaceId, name: 'API_KEY' });

    const plaintext = 'super-secret-value';
    const oldAad = valueAad(String(workspaceId), project.id, dev.id, String(secretId));
    const encrypted = await cipher.encrypt(plaintext, oldAad);
    secretValues.docs.push({
      secretId,
      environmentId: new Types.ObjectId(dev.id),
      workspaceId,
      valueVersion: 1,
      ...encrypted,
    });

    const duplicated = await service.duplicateEnvironment(String(ownerId), String(workspaceId), project.id, dev.id, {
      name: 'staging',
      slug: 'staging',
    });
    expect(duplicated.slug).toBe('staging');
    const copied = secretValues.docs.find((doc) => String(doc.environmentId) === duplicated.id);
    expect(copied).toBeDefined();
    expect(copied!.ciphertext).not.toBe(encrypted.ciphertext);
    expect(
      await cipher.decrypt(copied as any, valueAad(String(workspaceId), project.id, duplicated.id, String(secretId)))
    ).toBe(plaintext);

    const differentAad = valueAad(String(workspaceId), project.id, prod.id, String(secretId));
    secretValues.docs.push({
      secretId,
      environmentId: new Types.ObjectId(prod.id),
      workspaceId,
      valueVersion: 1,
      ...(await cipher.encrypt('different-secret', differentAad)),
    });
    const diff = await service.diffEnvironments(String(ownerId), String(workspaceId), project.id, dev.id, prod.id);
    expect(diff.items[0].status).toBe('DIFFERENT');
    expect(JSON.stringify(diff)).not.toContain(plaintext);
    expect(JSON.stringify(diff)).not.toContain('different-secret');

    await service.archiveEnvironment(String(ownerId), String(workspaceId), project.id, prod.id);
    await expect(
      service.resolveEnvironment(String(ownerId), String(workspaceId), project.id, prod.id)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
