import type {
  EnvironmentCreateInput,
  EnvironmentDuplicateInput,
  EnvironmentUpdateInput,
  Permission,
  ProjectCreateInput,
  ProjectMemberCreateInput,
  ProjectMemberRoleUpdateInput,
  ProjectRole,
  ProjectUpdateInput,
} from '@aegis/shared';
import { Types, type Connection, type Model } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/http-error';
import { EnvelopeCipherService } from '../crypto/envelope-cipher.service';
import { valueAad } from '../crypto/value-cipher.service';
import { assertSafeInput } from '../database/safe-input';
import { withTransaction } from '../database/transaction';
import { ProjectAccessService } from './project-access.service';
import type {
  DiffEntryView,
  EnvironmentRecord,
  EnvironmentView,
  ProjectMemberRecord,
  ProjectMemberView,
  ProjectRecord,
  ProjectSummary,
  ProjectView,
  SecretRecord,
  SecretValueRecord,
} from './types';

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mask(): string {
  return '******';
}

export class ProjectsService {
  constructor(
    private readonly users: Model<{ email: string }>,
    private readonly projects: Model<ProjectRecord>,
    private readonly projectMembers: Model<ProjectMemberRecord>,
    private readonly environments: Model<EnvironmentRecord>,
    private readonly secrets: Model<SecretRecord>,
    private readonly secretValues: Model<SecretValueRecord>,
    private readonly secretHistory: Model<any>,
    private readonly serviceTokens: Model<any>,
    private readonly auditLogs: Model<any>,
    private readonly webhooks: Model<any>,
    private readonly connection: Connection,
    private readonly cipher: EnvelopeCipherService,
    private readonly access: ProjectAccessService,
    private readonly webhookDeliveries?: Model<any>
  ) {}

  async create(userId: string, workspaceId: string, input: ProjectCreateInput): Promise<ProjectView> {
    if (input.settings) {
      assertSafeInput(input.settings);
    }
    await this.access.requireWorkspaceMember(userId, workspaceId);
    const existing = await this.projects
      .findOne({ workspaceId: objectId(workspaceId), slug: input.slug })
      .exec();
    if (existing) {
      throw new ConflictException('Project slug already in use');
    }

    const project = await withTransaction(this.connection, async (session) => {
      const [created] = await this.projects.create(
        [
          {
            workspaceId: objectId(workspaceId),
            name: input.name,
            slug: input.slug,
            description: input.description,
            settings: input.settings ?? {},
            archivedAt: null,
          },
        ],
        { session }
      );
      await this.projectMembers.create(
        [
          {
            projectId: created._id,
            workspaceId: objectId(workspaceId),
            userId: objectId(userId),
            role: 'OWNER' as ProjectRole,
            customPermissions: [] as Permission[],
          },
        ],
        { session }
      );
      return created;
    });

    return this.projectView(project, await this.summary(project, workspaceId));
  }

  async list(userId: string, workspaceId: string): Promise<ProjectView[]> {
    await this.access.requireWorkspaceMember(userId, workspaceId);
    const memberships = await this.projectMembers
      .find({ workspaceId: objectId(workspaceId), userId: objectId(userId) })
      .exec();
    const projects = await this.projects
      .find({
        workspaceId: objectId(workspaceId),
        _id: { $in: memberships.map((membership) => membership.projectId) },
      })
      .exec();
    return Promise.all(projects.map((project) => this.projectView(project, this.emptySummary())));
  }

  async get(userId: string, workspaceId: string, projectId: string): Promise<ProjectView> {
    const project = await this.access.requireActiveProject(userId, workspaceId, projectId);
    return this.projectView(project, await this.summary(project, workspaceId));
  }

  async update(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: ProjectUpdateInput
  ): Promise<ProjectView> {
    await this.access.requireProject(userId, workspaceId, projectId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    if (input.settings) {
      assertSafeInput(input.settings);
    }
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.description !== undefined) set.description = input.description;
    if (input.settings !== undefined) set.settings = input.settings;
    await this.projects.updateOne(
      { _id: objectId(projectId), workspaceId: objectId(workspaceId) },
      { $set: set }
    );
    const project = await this.access.requireProject(userId, workspaceId, projectId);
    return this.projectView(project, await this.summary(project, workspaceId));
  }

  async archive(userId: string, workspaceId: string, projectId: string): Promise<ProjectView> {
    await this.access.requireProject(userId, workspaceId, projectId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.projects.updateOne(
      { _id: objectId(projectId), workspaceId: objectId(workspaceId) },
      { $set: { archivedAt: new Date() } }
    );
    const archived = await this.access.requireProject(userId, workspaceId, projectId);
    return this.projectView(archived, await this.summary(archived, workspaceId));
  }

  async restore(userId: string, workspaceId: string, projectId: string): Promise<ProjectView> {
    await this.access.requireProject(userId, workspaceId, projectId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.projects.updateOne(
      { _id: objectId(projectId), workspaceId: objectId(workspaceId) },
      { $set: { archivedAt: null } }
    );
    return this.get(userId, workspaceId, projectId);
  }

  async remove(userId: string, workspaceId: string, projectId: string, confirmation: string): Promise<void> {
    const project = await this.access.requireProject(userId, workspaceId, projectId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    if (confirmation !== project.slug) {
      throw new BadRequestException('Confirmation does not match the project slug');
    }
    const workspace = objectId(workspaceId);
    const projectObjectId = objectId(projectId);
    const secrets = await this.secrets.find({ projectId: projectObjectId, workspaceId: workspace }).exec();
    const secretIds = secrets.map((secret) => secret._id);

    await withTransaction(this.connection, async (session) => {
      await this.secretValues.deleteMany({ secretId: { $in: secretIds }, workspaceId: workspace }, { session });
      await this.secretHistory.deleteMany({ secretId: { $in: secretIds }, workspaceId: workspace }, { session });
      await this.secrets.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      await this.environments.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      await this.projectMembers.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      await this.serviceTokens.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      await this.auditLogs.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      await this.webhooks.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      if (this.webhookDeliveries) {
        await this.webhookDeliveries.deleteMany({ projectId: projectObjectId, workspaceId: workspace }, { session });
      }
      await this.projects.deleteOne({ _id: projectObjectId, workspaceId: workspace }, { session });
    });
  }

  async listMembers(userId: string, workspaceId: string, projectId: string): Promise<ProjectMemberView[]> {
    await this.access.requireProjectMember(userId, workspaceId, projectId);
    const members = await this.projectMembers
      .find({ projectId: objectId(projectId), workspaceId: objectId(workspaceId) })
      .exec();
    return Promise.all(
      members.map(async (member) => {
        const user = await this.users.findById(member.userId).exec();
        return {
          userId: String(member.userId),
          email: user?.email ?? '',
          role: member.role,
          customPermissions: member.customPermissions ?? [],
        };
      })
    );
  }

  async addMember(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: ProjectMemberCreateInput
  ): Promise<ProjectMemberView> {
    await this.access.requireProject(userId, workspaceId, projectId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const email = normalizeEmail(input.email);
    const user = await this.users.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException();
    }
    const targetId = String((user as any)._id);
    await this.access.requireWorkspaceMember(targetId, workspaceId);
    const existing = await this.projectMembers
      .findOne({
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
        userId: objectId(targetId),
      })
      .exec();
    if (existing) {
      throw new ConflictException('User is already a project member');
    }
    const member = await this.projectMembers.create({
      projectId: objectId(projectId),
      workspaceId: objectId(workspaceId),
      userId: objectId(targetId),
      role: input.role,
      customPermissions: input.customPermissions,
    });
    return { userId: targetId, email, role: member.role, customPermissions: member.customPermissions };
  }

  async changeMemberRole(
    userId: string,
    workspaceId: string,
    projectId: string,
    targetUserId: string,
    input: ProjectMemberRoleUpdateInput
  ): Promise<ProjectMemberView> {
    await this.access.requireProject(userId, workspaceId, projectId);
    const actor = await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const target = await this.findProjectMember(workspaceId, projectId, targetUserId);
    if (target.role === 'OWNER' && actor.role !== 'OWNER' && input.role !== 'OWNER') {
      throw new ForbiddenException('Only an owner can demote an owner');
    }
    if (target.role === 'OWNER' && input.role !== 'OWNER') {
      const owners = await this.projectMembers.countDocuments({
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
        role: 'OWNER',
      });
      if (owners <= 1) {
        throw new BadRequestException('A project must keep at least one owner');
      }
    }
    await this.projectMembers.updateOne(
      { _id: (target as any)._id },
      {
        $set: {
          role: input.role,
          ...(input.customPermissions ? { customPermissions: input.customPermissions } : {}),
        },
      }
    );
    const user = await this.users.findById(objectId(targetUserId)).exec();
    return {
      userId: targetUserId,
      email: user?.email ?? '',
      role: input.role,
      customPermissions: input.customPermissions ?? target.customPermissions ?? [],
    };
  }

  async removeMember(
    userId: string,
    workspaceId: string,
    projectId: string,
    targetUserId: string
  ): Promise<void> {
    await this.access.requireProject(userId, workspaceId, projectId);
    const actor = await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const target = await this.findProjectMember(workspaceId, projectId, targetUserId);
    if (target.role === 'OWNER') {
      if (actor.role !== 'OWNER') {
        throw new ForbiddenException('Only an owner can remove an owner');
      }
      const owners = await this.projectMembers.countDocuments({
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
        role: 'OWNER',
      });
      if (owners <= 1) {
        throw new BadRequestException('A project must keep at least one owner');
      }
    }
    await this.projectMembers.deleteOne({ _id: (target as any)._id });
  }

  async createEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: EnvironmentCreateInput
  ): Promise<EnvironmentView> {
    await this.access.requireProject(userId, workspaceId, projectId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.requireEnvironmentSlug(workspaceId, projectId, input.slug);
    const environment = await this.environments.create({
      projectId: objectId(projectId),
      workspaceId: objectId(workspaceId),
      name: input.name,
      slug: input.slug,
      archivedAt: null,
    });
    return this.environmentView(environment);
  }

  async listEnvironments(userId: string, workspaceId: string, projectId: string): Promise<EnvironmentView[]> {
    await this.access.requireProjectMember(userId, workspaceId, projectId);
    const environments = await this.environments
      .find({ projectId: objectId(projectId), workspaceId: objectId(workspaceId) })
      .exec();
    return environments.map((environment) => this.environmentView(environment));
  }

  async getEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentView> {
    return this.environmentView(await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId));
  }

  async updateEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string,
    input: EnvironmentUpdateInput
  ): Promise<EnvironmentView> {
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.environments.updateOne(
      { _id: objectId(environmentId), projectId: objectId(projectId), workspaceId: objectId(workspaceId) },
      { $set: { name: input.name } }
    );
    return this.getEnvironment(userId, workspaceId, projectId, environmentId);
  }

  async archiveEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentView> {
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.environments.updateOne(
      { _id: objectId(environmentId), projectId: objectId(projectId), workspaceId: objectId(workspaceId) },
      { $set: { archivedAt: new Date() } }
    );
    return this.getEnvironment(userId, workspaceId, projectId, environmentId);
  }

  async restoreEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentView> {
    await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.environments.updateOne(
      { _id: objectId(environmentId), projectId: objectId(projectId), workspaceId: objectId(workspaceId) },
      { $set: { archivedAt: null } }
    );
    return this.getEnvironment(userId, workspaceId, projectId, environmentId);
  }

  async removeEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string,
    confirmation: string
  ): Promise<void> {
    const environment = await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    if (confirmation !== environment.slug) {
      throw new BadRequestException('Confirmation does not match the environment slug');
    }
    const workspace = objectId(workspaceId);
    const secretIds = (await this.secrets.find({ projectId: objectId(projectId), workspaceId: workspace }).exec()).map(
      (secret) => secret._id
    );
    await withTransaction(this.connection, async (session) => {
      await this.secretValues.deleteMany(
        { environmentId: objectId(environmentId), secretId: { $in: secretIds }, workspaceId: workspace },
        { session }
      );
      await this.secretHistory.deleteMany(
        { environmentId: objectId(environmentId), secretId: { $in: secretIds }, workspaceId: workspace },
        { session }
      );
      await this.environments.deleteOne(
        { _id: objectId(environmentId), projectId: objectId(projectId), workspaceId: workspace },
        { session }
      );
    });
  }

  async duplicateEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    sourceEnvironmentId: string,
    input: EnvironmentDuplicateInput
  ): Promise<EnvironmentView> {
    const source = await this.access.requireEnvironment(userId, workspaceId, projectId, sourceEnvironmentId);
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.requireEnvironmentSlug(workspaceId, projectId, input.slug);
    const workspace = objectId(workspaceId);
    const project = objectId(projectId);
    const secrets = await this.secrets.find({ projectId: project, workspaceId: workspace }).exec();
    const values = await this.secretValues
      .find({ environmentId: (source as any)._id, workspaceId: workspace })
      .exec();
    const valueMap = new Map(values.map((value) => [String(value.secretId), value]));

    const created = await withTransaction(this.connection, async (session) => {
      const [environment] = await this.environments.create(
        [
          {
            projectId: project,
            workspaceId: workspace,
            name: input.name,
            slug: input.slug,
            archivedAt: null,
          },
        ],
        { session }
      );
      const copies = (
        await Promise.all(
          secrets.map(async (secret) => {
            const value = valueMap.get(String(secret._id));
            if (!value) {
              return [];
            }
            const oldAad = valueAad(workspaceId, projectId, sourceEnvironmentId, String(secret._id));
            const newAad = valueAad(workspaceId, projectId, String(environment._id), String(secret._id));
            const plaintext = await this.cipher.decrypt(value, oldAad);
            const encrypted = await this.cipher.encrypt(plaintext, newAad);
            return [
              {
                secretId: secret._id,
                environmentId: environment._id,
                workspaceId: workspace,
                valueVersion: 1,
                ...encrypted,
              },
            ];
          })
        )
      ).flat();
      if (copies.length > 0) {
        await this.secretValues.create(copies, { session });
      }
      return environment;
    });

    return this.environmentView(created);
  }

  async diffEnvironments(
    userId: string,
    workspaceId: string,
    projectId: string,
    fromEnvironmentId: string,
    toEnvironmentId: string
  ): Promise<{ items: DiffEntryView[] }> {
    await this.access.requireEnvironment(userId, workspaceId, projectId, fromEnvironmentId);
    await this.access.requireEnvironment(userId, workspaceId, projectId, toEnvironmentId);
    const workspace = objectId(workspaceId);
    const secrets = await this.secrets.find({ projectId: objectId(projectId), workspaceId: workspace }).exec();
    const [leftValues, rightValues] = await Promise.all([
      this.secretValues.find({ environmentId: objectId(fromEnvironmentId), workspaceId: workspace }).exec(),
      this.secretValues.find({ environmentId: objectId(toEnvironmentId), workspaceId: workspace }).exec(),
    ]);
    const leftMap = new Map(leftValues.map((value) => [String(value.secretId), value]));
    const rightMap = new Map(rightValues.map((value) => [String(value.secretId), value]));
    const items = await Promise.all(
      secrets.map(async (secret) => {
        const secretId = String(secret._id);
        const left = leftMap.get(secretId);
        const right = rightMap.get(secretId);
        const leftPlain = left
          ? await this.cipher.decrypt(left, valueAad(workspaceId, projectId, fromEnvironmentId, secretId))
          : undefined;
        const rightPlain = right
          ? await this.cipher.decrypt(right, valueAad(workspaceId, projectId, toEnvironmentId, secretId))
          : undefined;
        const status: DiffEntryView['status'] =
          leftPlain === undefined && rightPlain === undefined
            ? 'SAME'
            : leftPlain === undefined
              ? 'ONLY_RIGHT'
              : rightPlain === undefined
                ? 'ONLY_LEFT'
                : leftPlain === rightPlain
                  ? 'SAME'
                  : 'DIFFERENT';
        return {
          name: secret.name,
          status,
          left: { present: leftPlain !== undefined, masked: leftPlain === undefined ? null : mask() },
          right: { present: rightPlain !== undefined, masked: rightPlain === undefined ? null : mask() },
        };
      })
    );
    return { items };
  }

  async resolveEnvironment(
    userId: string,
    workspaceId: string,
    projectId: string,
    environmentId: string
  ): Promise<{ workspaceId: string; projectId: string; environmentId: string; name: string; slug: string }> {
    const environment = await this.access.requireEnvironment(userId, workspaceId, projectId, environmentId);
    if (environment.archivedAt) {
      throw new NotFoundException();
    }
    return {
      workspaceId,
      projectId,
      environmentId,
      name: environment.name,
      slug: environment.slug,
    };
  }

  private async findProjectMember(
    workspaceId: string,
    projectId: string,
    userId: string
  ): Promise<ProjectMemberRecord> {
    const member = await this.projectMembers
      .findOne({
        projectId: objectId(projectId),
        workspaceId: objectId(workspaceId),
        userId: objectId(userId),
      })
      .exec();
    if (!member) {
      throw new NotFoundException();
    }
    return member;
  }

  private async requireEnvironmentSlug(workspaceId: string, projectId: string, slug: string): Promise<void> {
    const existing = await this.environments
      .findOne({ projectId: objectId(projectId), workspaceId: objectId(workspaceId), slug })
      .exec();
    if (existing) {
      throw new ConflictException('Environment slug already in use');
    }
  }

  private async summary(project: ProjectRecord, workspaceId: string): Promise<ProjectSummary> {
    const workspace = objectId(workspaceId);
    const secrets = await this.secrets
      .find({ projectId: (project as any)._id, workspaceId: workspace })
      .exec();
    const secretIds = secrets.map((secret) => secret._id);
    const [environments, members, values] = await Promise.all([
      this.environments.countDocuments({ projectId: (project as any)._id, workspaceId: workspace }),
      this.projectMembers.countDocuments({ projectId: (project as any)._id, workspaceId: workspace }),
      this.secretValues.countDocuments({ secretId: { $in: secretIds }, workspaceId: workspace }),
    ]);
    return {
      secrets: secrets.length,
      environments,
      members,
      secretValues: values,
      lastActivityAt: project.updatedAt?.toISOString() ?? null,
    };
  }

  private emptySummary(): ProjectSummary {
    return { secrets: 0, environments: 0, members: 0, secretValues: 0, lastActivityAt: null };
  }

  private projectView(project: ProjectRecord, summary: ProjectSummary): ProjectView {
    return {
      id: String((project as any)._id),
      name: project.name,
      slug: project.slug,
      description: project.description,
      settings: project.settings ?? {},
      archived: Boolean(project.archivedAt),
      summary,
    };
  }

  private environmentView(environment: EnvironmentRecord): EnvironmentView {
    return {
      id: String((environment as any)._id),
      projectId: String(environment.projectId),
      name: environment.name,
      slug: environment.slug,
      archived: Boolean(environment.archivedAt),
    };
  }
}
