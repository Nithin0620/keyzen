import { Types, type Model } from 'mongoose';
import { ForbiddenException, NotFoundException } from '../common/http-error';
import type { EnvironmentRecord, ProjectMemberRecord, ProjectRecord } from './types';

interface UserStatus {
  status: string;
}

interface WorkspaceMember {
  role: string;
}

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

export class ProjectAccessService {
  constructor(
    private readonly users: Model<UserStatus>,
    private readonly workspaceMembers: Model<WorkspaceMember>,
    private readonly projects: Model<ProjectRecord>,
    private readonly projectMembers: Model<ProjectMemberRecord>,
    private readonly environments: Model<EnvironmentRecord>
  ) {}

  async requireWorkspaceMember(userId: string, workspaceId: string): Promise<void> {
    const user = await this.users.findById(objectId(userId)).exec();
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException();
    }
    const member = await this.workspaceMembers
      .findOne({ workspaceId: objectId(workspaceId), userId: objectId(userId) })
      .exec();
    if (!member) {
      throw new ForbiddenException('Workspace access denied');
    }
  }

  async requireProject(userId: string, workspaceId: string, projectId: string): Promise<ProjectRecord> {
    await this.requireWorkspaceMember(userId, workspaceId);
    const project = await this.projects
      .findOne({ _id: objectId(projectId), workspaceId: objectId(workspaceId) })
      .exec();
    if (!project) {
      throw new NotFoundException();
    }
    return project;
  }

  async requireActiveProject(userId: string, workspaceId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.requireProject(userId, workspaceId, projectId);
    if (project.archivedAt) {
      throw new NotFoundException();
    }
    return project;
  }

  async requireProjectMember(
    userId: string,
    workspaceId: string,
    projectId: string
  ): Promise<ProjectMemberRecord> {
    await this.requireWorkspaceMember(userId, workspaceId);
    const member = await this.projectMembers
      .findOne({
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
        userId: objectId(userId),
      })
      .exec();
    if (!member) {
      throw new ForbiddenException('Project membership required');
    }
    return member;
  }

  async requireProjectAdmin(userId: string, workspaceId: string, projectId: string): Promise<ProjectMemberRecord> {
    const member = await this.requireProjectMember(userId, workspaceId, projectId);
    if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
      throw new ForbiddenException('Project admin access required');
    }
    return member;
  }

  async requireEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentRecord> {
    await this.requireActiveProject(userId, workspaceId, projectId);
    const environment = await this.environments
      .findOne({
        _id: objectId(environmentId),
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
      })
      .exec();
    if (!environment) {
      throw new NotFoundException();
    }
    return environment;
  }

  async requireEnvironmentScope(
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentRecord> {
    const project = await this.projects
      .findOne({ _id: objectId(projectId), workspaceId: objectId(workspaceId) })
      .exec();
    if (!project || project.archivedAt) {
      throw new NotFoundException();
    }
    const environment = await this.environments
      .findOne({
        _id: objectId(environmentId),
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
      })
      .exec();
    if (!environment || environment.archivedAt) {
      throw new NotFoundException();
    }
    return environment;
  }
}
