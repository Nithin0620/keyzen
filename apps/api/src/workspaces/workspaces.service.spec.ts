import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../auth/mail.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/http-error';
import { UnsafeInputError } from '../database/safe-input';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceAccessService } from './workspace-access.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

type Filter = Record<string, any>;
type Update = Record<string, any>;

class Query<T> {
  constructor(private readonly run: () => Promise<T>) {}

  select(): this {
    return this;
  }

  exec(): Promise<T> {
    return this.run();
  }
}

function matches(doc: Filter, filter: Filter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && '$gt' in expected) {
      return actual instanceof Date && actual.getTime() > expected.$gt.getTime();
    }
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.some((item: unknown) => String(item) === String(actual));
    }
    if (expected instanceof Types.ObjectId || actual instanceof Types.ObjectId) {
      return String(actual) === String(expected);
    }
    return actual === expected;
  });
}

function applyUpdate(doc: Filter, update: Update): void {
  if (update.$set) {
    Object.assign(doc, update.$set);
  } else {
    Object.assign(doc, update);
  }
}

class FakeModel<T extends Filter = Filter> {
  readonly docs: Array<T & { _id: Types.ObjectId }> = [];

  readonly find = vi.fn((filter: Filter = {}) => new Query<T[]>(async () => this.docs.filter((doc) => matches(doc, filter))));

  readonly findOne = vi.fn((filter: Filter) => new Query<any>(async () => this.docs.find((doc) => matches(doc, filter)) ?? null));

  readonly findById = vi.fn((id: unknown) => new Query<any>(async () => this.docs.find((doc) => String(doc._id) === String(id)) ?? null));

  readonly findByIdAndUpdate = vi.fn((id: unknown, update: Update, _options?: unknown) => {
    const doc = this.docs.find((item) => String(item._id) === String(id));
    if (!doc) {
      return new Query<any>(async () => null);
    }
    applyUpdate(doc, update);
    return new Query<any>(async () => doc);
  });

  readonly create = vi.fn(async (input: T | T[], _options?: unknown) => {
    if (Array.isArray(input)) {
      const created = input.map((doc) => ({ _id: new Types.ObjectId(), ...doc }));
      this.docs.push(...created as Array<T & { _id: Types.ObjectId }>);
      return created;
    }
    const created = { _id: new Types.ObjectId(), ...input };
    this.docs.push(created as T & { _id: Types.ObjectId });
    return created;
  });

  readonly updateOne = vi.fn(async (filter: Filter, update: Update, _options?: unknown) => {
    const doc = this.docs.find((item) => matches(item, filter));
    if (!doc) {
      return { modifiedCount: 0 };
    }
    applyUpdate(doc, update);
    return { modifiedCount: 1 };
  });

  readonly updateMany = vi.fn(async (filter: Filter, update: Update, _options?: unknown) => {
    let modifiedCount = 0;
    for (const doc of this.docs) {
      if (matches(doc, filter)) {
        applyUpdate(doc, update);
        modifiedCount += 1;
      }
    }
    return { modifiedCount };
  });

  readonly deleteOne = vi.fn(async (filter: Filter, _options?: unknown) => {
    const index = this.docs.findIndex((doc) => matches(doc, filter));
    if (index === -1) {
      return { deletedCount: 0 };
    }
    this.docs.splice(index, 1);
    return { deletedCount: 1 };
  });

  readonly deleteMany = vi.fn(async (filter: Filter, _options?: unknown) => {
    const before = this.docs.length;
    this.docs.splice(0, this.docs.length, ...this.docs.filter((doc) => !matches(doc, filter)));
    return { deletedCount: before - this.docs.length };
  });

  readonly countDocuments = vi.fn(async (filter: Filter = {}) => this.docs.filter((doc) => matches(doc, filter)).length);

  asModel(): any {
    return this;
  }
}

function fakeConnection(): any {
  const session = {
    withTransaction: vi.fn(async (work: () => Promise<void>) => {
      await work();
    }),
    endSession: vi.fn(async () => undefined),
  };
  return { startSession: vi.fn(async () => session) };
}

describe('WorkspacesService', () => {
  let users: FakeModel<any>;
  let workspaces: FakeModel<any>;
  let members: FakeModel<any>;
  let invitations: FakeModel<any>;
  let projects: FakeModel<any>;
  let projectMembers: FakeModel<any>;
  let environments: FakeModel<any>;
  let secrets: FakeModel<any>;
  let secretValues: FakeModel<any>;
  let secretHistory: FakeModel<any>;
  let serviceTokens: FakeModel<any>;
  let auditLogs: FakeModel<any>;
  let webhooks: FakeModel<any>;
  let subscriptions: FakeModel<any>;
  let mail: MailService;
  let service: WorkspacesService;

  async function addUser(email: string, activeWorkspaceId: Types.ObjectId | null = null): Promise<any> {
    return users.create({
      email,
      status: 'ACTIVE',
      activeWorkspaceId,
      emailVerifiedAt: new Date(),
    });
  }

  beforeEach(() => {
    users = new FakeModel();
    workspaces = new FakeModel();
    members = new FakeModel();
    invitations = new FakeModel();
    projects = new FakeModel();
    projectMembers = new FakeModel();
    environments = new FakeModel();
    secrets = new FakeModel();
    secretValues = new FakeModel();
    secretHistory = new FakeModel();
    serviceTokens = new FakeModel();
    auditLogs = new FakeModel();
    webhooks = new FakeModel();
    subscriptions = new FakeModel();
    mail = new MailService();

    service = new WorkspacesService(
      users.asModel(),
      workspaces.asModel(),
      members.asModel(),
      invitations.asModel(),
      projects.asModel(),
      projectMembers.asModel(),
      environments.asModel(),
      secrets.asModel(),
      secretValues.asModel(),
      secretHistory.asModel(),
      serviceTokens.asModel(),
      auditLogs.asModel(),
      webhooks.asModel(),
      subscriptions.asModel(),
      fakeConnection(),
      mail,
      new WorkspaceAccessService(members.asModel(), users.asModel())
    );
  });

  it('creates, lists, selects and reads only workspaces the user belongs to', async () => {
    const owner = await addUser('owner@example.com');
    const outsider = await addUser('outsider@example.com');
    const ownerId = String(owner._id);
    const outsiderId = String(outsider._id);

    const created = await service.create(ownerId, { name: 'Core', slug: 'core', settings: { region: 'us' } });
    expect(created.active).toBe(true);
    expect(created.role).toBe('OWNER');
    expect(members.docs).toHaveLength(1);
    expect(members.docs[0].role).toBe('OWNER');
    expect(users.docs.find((doc) => String(doc._id) === ownerId)?.activeWorkspaceId).toEqual(workspaces.docs[0]._id);

    expect(await service.list(ownerId)).toHaveLength(1);
    expect(await service.list(outsiderId)).toEqual([]);
    await expect(service.get(outsiderId, created.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.select(outsiderId, created.id)).rejects.toBeInstanceOf(ForbiddenException);

    await service.select(ownerId, created.id);
    expect((await service.getActive(ownerId)).id).toBe(created.id);
    await expect(service.getActive(outsiderId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(ownerId, { name: 'Other', slug: 'core' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates safely and deletes the workspace with its full cascade only on exact confirmation', async () => {
    const owner = await addUser('owner@example.com');
    const ownerId = String(owner._id);
    const created = await service.create(ownerId, { name: 'Core', slug: 'core' });
    const workspaceId = new Types.ObjectId(created.id);

    await service.update(ownerId, created.id, { name: 'Renamed', settings: { tier: 'pro' } });
    expect(workspaces.docs[0].name).toBe('Renamed');
    expect(workspaces.docs[0].settings).toEqual({ tier: 'pro' });
    await expect(
      service.update(ownerId, created.id, { settings: { '$where': 'x' } } as any)
    ).rejects.toBeInstanceOf(UnsafeInputError);

    const memberUser = await addUser('member@example.com');
    await members.create({ workspaceId, userId: memberUser._id, role: 'MEMBER' });
    await expect(service.remove(String(memberUser._id), created.id, 'core')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(ownerId, created.id, 'wrong')).rejects.toBeInstanceOf(BadRequestException);

    await projects.create({ workspaceId, name: 'Project' });
    await projectMembers.create({ workspaceId, userId: owner._id, role: 'OWNER' });
    await environments.create({ workspaceId, name: 'dev' });
    await secrets.create({ workspaceId, name: 'API_KEY' });
    await secretValues.create({ workspaceId, ciphertext: 'cipher' });
    await secretHistory.create({ workspaceId, valueVersion: 1 });
    await serviceTokens.create({ workspaceId, tokenHash: 'hash' });
    await auditLogs.create({ workspaceId, action: 'workspace.created' });
    await webhooks.create({ workspaceId, url: 'https://example.com/hook' });
    await subscriptions.create({ workspaceId, plan: 'FREE' });

    await service.remove(ownerId, created.id, 'core');

    for (const model of [
      projects,
      projectMembers,
      environments,
      secrets,
      secretValues,
      secretHistory,
      serviceTokens,
      auditLogs,
      webhooks,
      subscriptions,
      invitations,
      members,
    ]) {
      expect(model.docs).toHaveLength(0);
    }
    expect(workspaces.docs).toHaveLength(0);
    expect(users.docs[0].activeWorkspaceId).toBeNull();
  });

  it('lists members, guards the last owner and transfers ownership with confirmation', async () => {
    const owner = await addUser('owner@example.com');
    const admin = await addUser('admin@example.com');
    const viewer = await addUser('viewer@example.com');
    const ownerId = String(owner._id);
    const adminId = String(admin._id);
    const viewerId = String(viewer._id);
    const created = await service.create(ownerId, { name: 'Core', slug: 'core' });
    const workspaceId = new Types.ObjectId(created.id);
    await members.create({ workspaceId, userId: admin._id, role: 'ADMIN' });
    await members.create({ workspaceId, userId: viewer._id, role: 'VIEWER' });

    expect(await service.listMembers(ownerId, created.id)).toHaveLength(3);
    expect((await service.changeRole(ownerId, created.id, viewerId, 'ADMIN')).role).toBe('ADMIN');
    await expect(service.changeRole(ownerId, created.id, ownerId, 'MEMBER')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.removeMember(ownerId, created.id, ownerId)).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.transferOwner(ownerId, created.id, adminId, 'wrong')).rejects.toBeInstanceOf(BadRequestException);
    const transferred = await service.transferOwner(ownerId, created.id, adminId, 'core');
    expect(transferred.ownerId).toBe(adminId);
    expect(members.docs.find((doc) => String(doc.userId) === ownerId)?.role).toBe('ADMIN');
    expect(members.docs.find((doc) => String(doc.userId) === adminId)?.role).toBe('OWNER');
    await expect(service.removeMember(ownerId, created.id, viewerId)).rejects.toBeInstanceOf(ForbiddenException);
    await service.removeMember(adminId, created.id, viewerId);
    expect(members.docs).toHaveLength(2);
  });

  it('creates hashed single-use invitations and blocks expired, reused, declined and revoked tokens', async () => {
    const owner = await addUser('owner@example.com');
    const ownerId = String(owner._id);
    const created = await service.create(ownerId, { name: 'Core', slug: 'core' });
    const outsider = await addUser('outsider@example.com');
    await expect(service.invite(String(outsider._id), created.id, { email: 'a@example.com', role: 'MEMBER' })).rejects.toBeInstanceOf(ForbiddenException);

    const invitation = await service.invite(ownerId, created.id, { email: 'Invitee@Example.com', role: 'MEMBER' });
    expect(invitation.status).toBe('PENDING');
    expect(invitation.email).toBe('invitee@example.com');
    expect(JSON.stringify(await service.listInvitations(ownerId, created.id))).not.toContain('tokenHash');
    const token = mail.takeDevToken('invitee@example.com', 'invite');
    expect(token).toBeDefined();
    expect(invitations.docs[0].tokenHash).not.toBe(token);

    const invitee = await addUser('invitee@example.com');
    const accepted = await service.acceptInvitation(String(invitee._id), token!);
    expect(accepted.id).toBe(created.id);
    expect(accepted.active).toBe(true);
    expect(invitations.docs[0].acceptedAt).toBeInstanceOf(Date);
    await expect(service.acceptInvitation(String(invitee._id), token!)).rejects.toBeInstanceOf(BadRequestException);

    const declinedInvite = await service.invite(ownerId, created.id, { email: 'decline@example.com', role: 'VIEWER' });
    const declinedToken = mail.takeDevToken('decline@example.com', 'invite')!;
    const declineUser = await addUser('decline@example.com');
    await service.declineInvitation(String(declineUser._id), declinedToken);
    await expect(service.acceptInvitation(String(declineUser._id), declinedToken)).rejects.toBeInstanceOf(BadRequestException);
    expect(declinedInvite.status).toBe('PENDING');

    const revokedInvite = await service.invite(ownerId, created.id, { email: 'revoked@example.com', role: 'ADMIN' });
    const revokedToken = mail.takeDevToken('revoked@example.com', 'invite')!;
    await service.revokeInvitation(ownerId, created.id, revokedInvite.id);
    const revokedUser = await addUser('revoked@example.com');
    await expect(service.acceptInvitation(String(revokedUser._id), revokedToken)).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.listInvitations(ownerId, created.id)).find((item) => item.id === revokedInvite.id)?.status).toBe('REVOKED');

    const expiredInvite = await service.invite(ownerId, created.id, { email: 'expired@example.com', role: 'MEMBER' });
    const expiredToken = mail.takeDevToken('expired@example.com', 'invite')!;
    invitations.docs.find((doc) => String(doc._id) === expiredInvite.id)!.expiresAt = new Date(Date.now() - 1000);
    const expiredUser = await addUser('expired@example.com');
    await expect(service.acceptInvitation(String(expiredUser._id), expiredToken)).rejects.toBeInstanceOf(BadRequestException);

    const mismatchUser = await addUser('different@example.com');
    await expect(service.acceptInvitation(String(mismatchUser._id), 'x'.repeat(40))).rejects.toBeInstanceOf(BadRequestException);
  });
});
