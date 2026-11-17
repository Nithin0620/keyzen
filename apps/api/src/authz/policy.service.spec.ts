import {
  permissions,
  projectRolePermissions,
  workspaceRolePermissions,
  type Permission,
  type ProjectRole,
  type WorkspaceRole,
} from '@aegis/shared';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { PolicyService } from './policy.service';

class Query<T> {
  constructor(private readonly run: () => Promise<T>) {}

  exec(): Promise<T> {
    return this.run();
  }
}

class FakeModel<T extends Record<string, any> = Record<string, any>> {
  readonly docs: Array<T & { _id: Types.ObjectId }> = [];

  findById(id: unknown): Query<any> {
    return new Query(async () => this.docs.find((doc) => String(doc._id) === String(id)) ?? null);
  }

  findOne(filter: Record<string, any>): Query<any> {
    return new Query(async () => {
      return (
        this.docs.find((doc) =>
          Object.entries(filter).every(([key, value]) =>
            value instanceof Types.ObjectId || doc[key] instanceof Types.ObjectId ? String(doc[key]) === String(value) : doc[key] === value
          )
        ) ?? null
      );
    });
  }

  add(input: T): any {
    const doc = { _id: new Types.ObjectId(), ...input };
    this.docs.push(doc as T & { _id: Types.ObjectId });
    return doc;
  }
}

describe('PolicyService', () => {
  const userId = new Types.ObjectId();
  const workspaceId = new Types.ObjectId();
  const otherWorkspaceId = new Types.ObjectId();
  const projectId = new Types.ObjectId();
  let users: FakeModel<any>;
  let workspaceMembers: FakeModel<any>;
  let projects: FakeModel<any>;
  let projectMembers: FakeModel<any>;
  let policy: PolicyService;

  beforeEach(() => {
    users = new FakeModel();
    workspaceMembers = new FakeModel();
    projects = new FakeModel();
    projectMembers = new FakeModel();
    users.add({ status: 'ACTIVE' });
    users.docs[0]._id = userId;
    projects.add({ workspaceId });
    projects.docs[0]._id = projectId;
    policy = new PolicyService(
      users as any,
      workspaceMembers as any,
      projects as any,
      projectMembers as any
    );
  });

  function setWorkspaceRole(role: string, id = workspaceId): void {
    workspaceMembers.docs.length = 0;
    workspaceMembers.add({ workspaceId: id, userId, role });
  }

  function setProjectRole(role: string, customPermissions: string[] = []): void {
    projectMembers.docs.length = 0;
    projectMembers.add({ projectId, workspaceId, userId, role, customPermissions });
  }

  it('grants only the permissions attached to each workspace role', async () => {
    for (const role of workspaceRolesFixture()) {
      setWorkspaceRole(role);
      for (const permission of permissions) {
        const expected = (workspaceRolePermissions[role] as readonly Permission[]).includes(permission);
        expect(await policy.evaluate(String(userId), permission, { workspaceId: String(workspaceId) })).toBe(expected);
      }
    }
  });

  it('requires explicit project membership and ignores workspace-only access', async () => {
    for (const role of projectRolesFixture()) {
      setWorkspaceRole('OWNER');
      setProjectRole(role);
      for (const permission of permissions) {
        const expected = (projectRolePermissions[role] as readonly Permission[]).includes(permission);
        expect(
          await policy.evaluate(String(userId), permission, {
            workspaceId: String(workspaceId),
            projectId: String(projectId),
          })
        ).toBe(expected);
      }
    }

    setWorkspaceRole('OWNER');
    projectMembers.docs.length = 0;
    for (const permission of permissions) {
      expect(
        await policy.evaluate(String(userId), permission, {
          workspaceId: String(workspaceId),
          projectId: String(projectId),
        })
      ).toBe(false);
    }
  });

  it('applies additive and revoking custom project permission overrides', async () => {
    setWorkspaceRole('VIEWER');
    setProjectRole('VIEWER', ['+secrets.read', 'secrets.export']);
    expect(await policy.evaluate(String(userId), 'secrets.read', { projectId: String(projectId) })).toBe(true);
    expect(await policy.evaluate(String(userId), 'secrets.export', { projectId: String(projectId) })).toBe(true);
    expect(await policy.evaluate(String(userId), 'secrets.create', { projectId: String(projectId) })).toBe(false);

    setProjectRole('OWNER', ['-billing.manage', 'invalid.permission']);
    expect(await policy.evaluate(String(userId), 'billing.manage', { projectId: String(projectId) })).toBe(false);
    expect(await policy.evaluate(String(userId), 'secrets.delete', { projectId: String(projectId) })).toBe(true);
  });

  it('denies inactive users, unknown roles, invalid ids and cross-workspace project ids', async () => {
    setWorkspaceRole('OWNER');
    setProjectRole('OWNER');
    users.docs[0].status = 'SUSPENDED';
    expect(await policy.evaluate(String(userId), 'secrets.read', { workspaceId: String(workspaceId) })).toBe(false);
    users.docs[0].status = 'ACTIVE';

    setWorkspaceRole('UNKNOWN');
    expect(await policy.evaluate(String(userId), 'secrets.read', { workspaceId: String(workspaceId) })).toBe(false);

    setProjectRole('UNKNOWN');
    expect(await policy.evaluate(String(userId), 'secrets.read', { projectId: String(projectId) })).toBe(false);

    setProjectRole('OWNER');
    expect(await policy.evaluate(String(userId), 'secrets.read', { projectId: String(projectId), workspaceId: String(otherWorkspaceId) })).toBe(false);
    expect(await policy.evaluate('not-an-id', 'secrets.read', { workspaceId: String(workspaceId) })).toBe(false);
  });
});

function workspaceRolesFixture(): WorkspaceRole[] {
  return ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
}

function projectRolesFixture(): ProjectRole[] {
  return ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'];
}
