import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  projectRolePermissions,
  workspaceRolePermissions,
  type Permission,
  type ProjectRole,
  type WorkspaceRole,
} from '@aegis/shared';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { AuthController } from '../auth/auth.controller';
import { HealthController } from '../health/health.controller';
import { ProjectsController } from '../projects/projects.controller';
import { SecretsController } from '../secrets/secrets.controller';
import { WorkspacesController } from '../workspaces/workspaces.controller';
import { PolicyService } from './policy.service';
import {
  AUTHENTICATED,
  PERMISSION_METADATA,
  type PermissionRequirement,
} from './require-permission.decorator';

class Query<T> {
  constructor(private readonly run: () => Promise<T>) {}

  exec(): Promise<T> {
    return this.run();
  }
}

class FakeModel {
  readonly docs: Array<Record<string, any> & { _id: Types.ObjectId }> = [];

  findById(id: unknown): Query<any> {
    return new Query(async () => this.docs.find((doc) => String(doc._id) === String(id)) ?? null);
  }

  findOne(filter: Record<string, any>): Query<any> {
    return new Query(async () => {
      return (
        this.docs.find((doc) =>
          Object.entries(filter).every(([key, value]) =>
            value instanceof Types.ObjectId || doc[key] instanceof Types.ObjectId
              ? String(doc[key]) === String(value)
              : doc[key] === value
          )
        ) ?? null
      );
    });
  }

  add(input: Record<string, any>): void {
    this.docs.push({ _id: new Types.ObjectId(), ...input });
  }
}

const reflector = new Reflector();
const controllers: Type[] = [
  HealthController,
  AuthController,
  WorkspacesController,
  ProjectsController,
  SecretsController,
];
const userId = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const projectId = new Types.ObjectId();

function endpointPermissions(): Permission[] {
  const found: Permission[] = [];
  for (const controller of controllers) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (name === 'constructor' || typeof handler !== 'function') {
        continue;
      }
      if (reflector.get<RequestMethod>(METHOD_METADATA, handler) === undefined) {
        continue;
      }
      const requirement =
        reflector.get<PermissionRequirement>(PERMISSION_METADATA, handler) ??
        reflector.get<PermissionRequirement>(PERMISSION_METADATA, controller);
      if (requirement && requirement !== AUTHENTICATED && !found.includes(requirement)) {
        found.push(requirement);
      }
    }
  }
  return found;
}

function policyService(): { policy: PolicyService; workspaceMembers: FakeModel; projectMembers: FakeModel } {
  const users = new FakeModel();
  const workspaceMembers = new FakeModel();
  const projects = new FakeModel();
  const projectMembers = new FakeModel();
  users.add({ _id: userId, status: 'ACTIVE' });
  projects.add({ _id: projectId, workspaceId });
  return {
    policy: new PolicyService(users as any, workspaceMembers as any, projects as any, projectMembers as any),
    workspaceMembers,
    projectMembers,
  };
}

describe('role and permission endpoint matrix', () => {
  const endpoints = endpointPermissions();
  const workspaceRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
  const projectRoles: ProjectRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'];

  it('evaluates every workspace role against every protected endpoint permission', async () => {
    expect(endpoints.length).toBeGreaterThan(0);
    for (const role of workspaceRoles) {
      const { policy, workspaceMembers } = policyService();
      workspaceMembers.add({ workspaceId, userId, role });
      for (const endpointPermission of endpoints) {
        expect(
          await policy.evaluate(String(userId), endpointPermission, { workspaceId: String(workspaceId) })
        ).toBe((workspaceRolePermissions[role] as readonly Permission[]).includes(endpointPermission));
      }
    }
  });

  it('evaluates every project role against every protected endpoint permission with explicit membership', async () => {
    for (const role of projectRoles) {
      const { policy, workspaceMembers, projectMembers } = policyService();
      workspaceMembers.add({ workspaceId, userId, role: 'VIEWER' });
      projectMembers.add({ projectId, workspaceId, userId, role, customPermissions: [] });
      for (const endpointPermission of endpoints) {
        expect(
          await policy.evaluate(String(userId), endpointPermission, {
            workspaceId: String(workspaceId),
            projectId: String(projectId),
          })
        ).toBe((projectRolePermissions[role] as readonly Permission[]).includes(endpointPermission));
      }
    }
  });

  it('denies every protected endpoint permission without explicit project membership', async () => {
    for (const role of workspaceRoles) {
      const { policy, workspaceMembers } = policyService();
      workspaceMembers.add({ workspaceId, userId, role });
      for (const endpointPermission of endpoints) {
        expect(
          await policy.evaluate(String(userId), endpointPermission, {
            workspaceId: String(workspaceId),
            projectId: String(projectId),
          })
        ).toBe(false);
      }
    }
  });
});
