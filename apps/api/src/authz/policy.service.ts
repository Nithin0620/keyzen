import {
  permissions,
  projectRolePermissions,
  workspaceRolePermissions,
  type Permission,
  type ProjectRole,
  type WorkspaceRole,
} from '@aegis/shared';
import { Types, type Model } from 'mongoose';

export interface PolicyContext {
  workspaceId?: string;
  projectId?: string;
}

interface UserRecord {
  status: string;
}

interface WorkspaceMemberRecord {
  role: string;
}

interface ProjectRecord {
  workspaceId: Types.ObjectId;
}

interface ProjectMemberRecord {
  role: string;
  customPermissions: string[];
}

function objectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function isPermission(value: string): value is Permission {
  return (permissions as readonly string[]).includes(value);
}

function withOverrides(role: ProjectRole, overrides: string[]): Set<Permission> {
  const granted = new Set<Permission>(projectRolePermissions[role]);
  for (const entry of overrides) {
    if (typeof entry !== 'string') {
      continue;
    }
    const revoke = entry.startsWith('-');
    const name = revoke || entry.startsWith('+') ? entry.slice(1) : entry;
    if (!isPermission(name)) {
      continue;
    }
    if (revoke) {
      granted.delete(name);
    } else {
      granted.add(name);
    }
  }
  return granted;
}

export class PolicyService {
  constructor(
    private readonly users: Model<UserRecord>,
    private readonly workspaceMembers: Model<WorkspaceMemberRecord>,
    private readonly projects: Model<ProjectRecord>,
    private readonly projectMembers: Model<ProjectMemberRecord>
  ) {}

  async evaluate(userId: string, permission: Permission, context: PolicyContext): Promise<boolean> {
    const userIdObject = objectId(userId);
    if (!userIdObject) {
      return false;
    }
    const user = await this.users.findById(userIdObject).exec();
    if (!user || user.status !== 'ACTIVE') {
      return false;
    }

    if (context.projectId) {
      const projectId = objectId(context.projectId);
      if (!projectId) {
        return false;
      }
      const project = await this.projects.findById(projectId).exec();
      if (!project) {
        return false;
      }
      const workspaceId = context.workspaceId ? objectId(context.workspaceId) : project.workspaceId;
      if (!workspaceId || String(workspaceId) !== String(project.workspaceId)) {
        return false;
      }
      const workspaceMember = await this.workspaceMembers
        .findOne({ workspaceId, userId: userIdObject })
        .exec();
      if (!workspaceMember) {
        return false;
      }
      const projectMember = await this.projectMembers
        .findOne({ projectId, workspaceId, userId: userIdObject })
        .exec();
      if (!projectMember) {
        return false;
      }
      const role = projectMember.role as ProjectRole;
      if (!Object.prototype.hasOwnProperty.call(projectRolePermissions, role)) {
        return false;
      }
      return withOverrides(role, projectMember.customPermissions ?? []).has(permission);
    }

    if (!context.workspaceId) {
      return false;
    }
    const workspaceId = objectId(context.workspaceId);
    if (!workspaceId) {
      return false;
    }
    const member = await this.workspaceMembers.findOne({ workspaceId, userId: userIdObject }).exec();
    if (!member) {
      return false;
    }
    const role = member.role as WorkspaceRole;
    if (!Object.prototype.hasOwnProperty.call(workspaceRolePermissions, role)) {
      return false;
    }
    return workspaceRolePermissions[role].includes(permission);
  }
}
