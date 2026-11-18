import type { InvitationCreateInput, MemberRole, WorkspaceCreateInput, WorkspaceUpdateInput } from '@aegis/shared';
import { Types, type Connection, type Model } from 'mongoose';
import { MailService } from '../auth/mail.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/http-error';
import { hashToken, randomToken } from '../common/tokens';
import { assertSafeInput } from '../database/safe-input';
import { withTransaction } from '../database/transaction';
import type { InvitationView, MemberView, TenantRecord, WorkspaceMemberRecord, WorkspaceRecord, WorkspaceUserRecord, WorkspaceView } from './types';
import { WorkspaceAccessService } from './workspace-access.service';

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class WorkspacesService {
  constructor(
    private readonly users: Model<WorkspaceUserRecord>,
    private readonly workspaces: Model<WorkspaceRecord>,
    private readonly members: Model<WorkspaceMemberRecord>,
    private readonly invitations: Model<any>,
    private readonly projects: Model<TenantRecord>,
    private readonly projectMembers: Model<TenantRecord>,
    private readonly environments: Model<TenantRecord>,
    private readonly secrets: Model<TenantRecord>,
    private readonly secretValues: Model<TenantRecord>,
    private readonly secretHistory: Model<TenantRecord>,
    private readonly serviceTokens: Model<TenantRecord>,
    private readonly auditLogs: Model<TenantRecord>,
    private readonly webhooks: Model<TenantRecord>,
    private readonly subscriptions: Model<TenantRecord>,
    private readonly connection: Connection,
    private readonly mail: MailService,
    private readonly access: WorkspaceAccessService
  ) {}

  async create(userId: string, input: WorkspaceCreateInput): Promise<WorkspaceView> {
    if (input.settings) {
      assertSafeInput(input.settings);
    }
    const userObjectId = objectId(userId);
    const existing = await this.workspaces.findOne({ slug: input.slug }).exec();
    if (existing) {
      throw new ConflictException('Workspace slug already in use');
    }

    const workspace = await withTransaction(this.connection, async (session) => {
      const created = await this.workspaces.create(
        [
          {
            name: input.name,
            slug: input.slug,
            description: input.description,
            settings: input.settings ?? {},
            ownerId: userObjectId,
          },
        ],
        { session }
      );
      await this.members.create(
        [{ workspaceId: created[0]._id, userId: userObjectId, role: 'OWNER' }],
        { session }
      );
      await this.users.updateOne({ _id: userObjectId }, { $set: { activeWorkspaceId: created[0]._id } }, { session });
      return created[0];
    });

    return this.view(workspace, 'OWNER', true);
  }

  async list(userId: string): Promise<WorkspaceView[]> {
    const userObjectId = objectId(userId);
    const memberships = await this.members.find({ userId: userObjectId }).exec();
    if (memberships.length === 0) {
      return [];
    }
    const workspaces = await this.workspaces
      .find({ _id: { $in: memberships.map((member) => member.workspaceId) } })
      .exec();
    const user = await this.users.findById(userObjectId).exec();
    const roles = new Map(memberships.map((member) => [String(member.workspaceId), member.role]));
    return workspaces.map((workspace) =>
      this.view(workspace, roles.get(String(workspace._id)) ?? 'VIEWER', this.isActive(user, workspace))
    );
  }

  async get(userId: string, workspaceId: string): Promise<WorkspaceView> {
    const member = await this.access.requireMember(userId, workspaceId);
    const workspace = await this.workspaces.findById(objectId(workspaceId)).exec();
    if (!workspace) {
      throw new NotFoundException();
    }
    const user = await this.users.findById(objectId(userId)).exec();
    return this.view(workspace, member.role, this.isActive(user, workspace));
  }

  async getActive(userId: string): Promise<WorkspaceView> {
    const user = await this.users.findById(objectId(userId)).exec();
    if (!user?.activeWorkspaceId) {
      throw new NotFoundException('No active workspace');
    }
    return this.get(userId, user.activeWorkspaceId.toString());
  }

  async select(userId: string, workspaceId: string): Promise<WorkspaceView> {
    await this.access.requireMember(userId, workspaceId);
    await this.users.updateOne(
      { _id: objectId(userId) },
      { $set: { activeWorkspaceId: objectId(workspaceId) } }
    );
    return this.get(userId, workspaceId);
  }

  async update(userId: string, workspaceId: string, input: WorkspaceUpdateInput): Promise<WorkspaceView> {
    const member = await this.access.requireAdmin(userId, workspaceId);
    if (input.settings) {
      assertSafeInput(input.settings);
    }
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) {
      set.name = input.name;
    }
    if (input.description !== undefined) {
      set.description = input.description;
    }
    if (input.settings !== undefined) {
      set.settings = input.settings;
    }
    const workspace = await this.workspaces
      .findByIdAndUpdate(objectId(workspaceId), { $set: set }, { new: true, runValidators: true })
      .exec();
    if (!workspace) {
      throw new NotFoundException();
    }
    return this.view(workspace, member.role, await this.isActiveById(userId, workspaceId));
  }

  async remove(userId: string, workspaceId: string, confirmation: string): Promise<void> {
    await this.access.requireOwner(userId, workspaceId);
    const objectWorkspaceId = objectId(workspaceId);
    const workspace = await this.workspaces.findById(objectWorkspaceId).exec();
    if (!workspace) {
      throw new NotFoundException();
    }
    if (confirmation !== workspace.slug) {
      throw new BadRequestException('Confirmation does not match the workspace slug');
    }

    await withTransaction(this.connection, async (session) => {
      const options = { session };
      await this.projectMembers.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.environments.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.secretValues.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.secretHistory.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.secrets.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.serviceTokens.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.webhooks.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.auditLogs.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.subscriptions.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.projects.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.invitations.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.members.deleteMany({ workspaceId: objectWorkspaceId }, options);
      await this.users.updateMany(
        { activeWorkspaceId: objectWorkspaceId },
        { $set: { activeWorkspaceId: null } },
        options
      );
      await this.workspaces.deleteOne({ _id: objectWorkspaceId }, options);
    });
  }

  async listMembers(userId: string, workspaceId: string): Promise<MemberView[]> {
    await this.access.requireMember(userId, workspaceId);
    const members = await this.members.find({ workspaceId: objectId(workspaceId) }).exec();
    return Promise.all(members.map((member) => this.memberView(member)));
  }

  async changeRole(userId: string, workspaceId: string, targetUserId: string, role: MemberRole): Promise<MemberView> {
    await this.access.requireOwner(userId, workspaceId);
    const target = await this.members
      .findOne({ workspaceId: objectId(workspaceId), userId: objectId(targetUserId) })
      .exec();
    if (!target) {
      throw new NotFoundException();
    }
    if (target.role === 'OWNER') {
      throw new BadRequestException('Use owner transfer to change the owner role');
    }
    await this.members.updateOne({ _id: target._id }, { $set: { role } });
    return this.memberView({ ...target, role });
  }

  async removeMember(userId: string, workspaceId: string, targetUserId: string): Promise<void> {
    await this.access.requireOwner(userId, workspaceId);
    const objectWorkspaceId = objectId(workspaceId);
    const target = await this.members
      .findOne({ workspaceId: objectWorkspaceId, userId: objectId(targetUserId) })
      .exec();
    if (!target) {
      throw new NotFoundException();
    }
    if (target.role === 'OWNER') {
      const owners = await this.members.countDocuments({ workspaceId: objectWorkspaceId, role: 'OWNER' });
      if (owners <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }
    await withTransaction(this.connection, async (session) => {
      await this.members.deleteOne({ _id: target._id }, { session });
      await this.users.updateMany(
        { _id: target.userId, activeWorkspaceId: objectWorkspaceId },
        { $set: { activeWorkspaceId: null } },
        { session }
      );
    });
  }

  async transferOwner(userId: string, workspaceId: string, targetUserId: string, confirmation: string): Promise<WorkspaceView> {
    const current = await this.access.requireOwner(userId, workspaceId);
    const objectWorkspaceId = objectId(workspaceId);
    const workspace = await this.workspaces.findById(objectWorkspaceId).exec();
    if (!workspace) {
      throw new NotFoundException();
    }
    if (confirmation !== workspace.slug) {
      throw new BadRequestException('Confirmation does not match the workspace slug');
    }
    const target = await this.members
      .findOne({ workspaceId: objectWorkspaceId, userId: objectId(targetUserId) })
      .exec();
    if (!target) {
      throw new NotFoundException();
    }

    await withTransaction(this.connection, async (session) => {
      await this.members.updateOne({ _id: current._id }, { $set: { role: 'ADMIN' } }, { session });
      await this.members.updateOne({ _id: target._id }, { $set: { role: 'OWNER' } }, { session });
      await this.workspaces.updateOne({ _id: objectWorkspaceId }, { $set: { ownerId: target.userId } }, { session });
    });
    return this.get(userId, workspaceId);
  }

  async invite(userId: string, workspaceId: string, input: InvitationCreateInput): Promise<InvitationView> {
    await this.access.requireAdmin(userId, workspaceId);
    const objectWorkspaceId = objectId(workspaceId);
    const workspace = await this.workspaces.findById(objectWorkspaceId).exec();
    if (!workspace) {
      throw new NotFoundException();
    }
    const email = normalizeEmail(input.email);
    const invitedUser = await this.users.findOne({ email }).exec();
    if (invitedUser) {
      const existingMember = await this.members
        .findOne({ workspaceId: objectWorkspaceId, userId: invitedUser._id })
        .exec();
      if (existingMember) {
        throw new ConflictException('User is already a workspace member');
      }
    }

    await this.invitations.updateMany(
      { workspaceId: objectWorkspaceId, email, acceptedAt: null, declinedAt: null, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    const token = randomToken(32);
    const invitation = await this.invitations.create({
      workspaceId: objectWorkspaceId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedBy: objectId(userId),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
    });
    await this.mail.send('invite', email, token, workspace.name);
    return this.invitationView(invitation);
  }

  async listInvitations(userId: string, workspaceId: string): Promise<InvitationView[]> {
    await this.access.requireAdmin(userId, workspaceId);
    const invitations = await this.invitations.find({ workspaceId: objectId(workspaceId) }).exec();
    return invitations.map((invitation) => this.invitationView(invitation));
  }

  async acceptInvitation(userId: string, token: string): Promise<WorkspaceView> {
    const user = await this.users.findById(objectId(userId)).exec();
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException();
    }
    const invitation = await this.findPendingInvitation(token);
    if (normalizeEmail(user.email) !== invitation.email) {
      throw new ForbiddenException('Invitation belongs to another email address');
    }

    await withTransaction(this.connection, async (session) => {
      const existing = await this.members
        .findOne({ workspaceId: invitation.workspaceId, userId: user._id })
        .exec();
      if (!existing) {
        await this.members.create(
          [{ workspaceId: invitation.workspaceId, userId: user._id, role: invitation.role }],
          { session }
        );
      }
      await this.invitations.updateOne({ _id: invitation._id }, { $set: { acceptedAt: new Date() } }, { session });
      await this.users.updateOne(
        { _id: user._id, activeWorkspaceId: null },
        { $set: { activeWorkspaceId: invitation.workspaceId } },
        { session }
      );
    });
    return this.get(userId, invitation.workspaceId.toString());
  }

  async declineInvitation(userId: string, token: string): Promise<void> {
    const user = await this.users.findById(objectId(userId)).exec();
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException();
    }
    const invitation = await this.findPendingInvitation(token);
    if (normalizeEmail(user.email) !== invitation.email) {
      throw new ForbiddenException('Invitation belongs to another email address');
    }
    await this.invitations.updateOne({ _id: invitation._id }, { $set: { declinedAt: new Date() } });
  }

  async revokeInvitation(userId: string, workspaceId: string, invitationId: string): Promise<void> {
    await this.access.requireAdmin(userId, workspaceId);
    const invitation = await this.invitations
      .findOne({ _id: objectId(invitationId), workspaceId: objectId(workspaceId) })
      .exec();
    if (!invitation) {
      throw new NotFoundException();
    }
    if (
      invitation.acceptedAt ||
      invitation.declinedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invitation is no longer pending');
    }
    await this.invitations.updateOne({ _id: invitation._id }, { $set: { revokedAt: new Date() } });
  }

  private async findPendingInvitation(token: string): Promise<any> {
    const invitation = await this.invitations
      .findOne({
        tokenHash: hashToken(token),
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .exec();
    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    return invitation;
  }

  private async isActiveById(userId: string, workspaceId: string): Promise<boolean> {
    const user = await this.users.findById(objectId(userId)).exec();
    return this.isActive(user, { _id: objectId(workspaceId) } as WorkspaceRecord);
  }

  private isActive(user: WorkspaceUserRecord | null, workspace: Pick<WorkspaceRecord, '_id'>): boolean {
    return Boolean(user?.activeWorkspaceId && String(user.activeWorkspaceId) === String(workspace._id));
  }

  private async memberView(member: WorkspaceMemberRecord): Promise<MemberView> {
    const user = await this.users.findById(member.userId).exec();
    return {
      userId: String(member.userId),
      email: user?.email ?? '',
      name: user?.name,
      role: member.role,
    };
  }

  private view(workspace: WorkspaceRecord, role: WorkspaceView['role'], active: boolean): WorkspaceView {
    return {
      id: String(workspace._id),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      settings: workspace.settings ?? {},
      ownerId: String(workspace.ownerId),
      role,
      active,
    };
  }

  private invitationView(invitation: any): InvitationView {
    let status: InvitationView['status'] = 'PENDING';
    if (invitation.acceptedAt) {
      status = 'ACCEPTED';
    } else if (invitation.declinedAt) {
      status = 'DECLINED';
    } else if (invitation.revokedAt) {
      status = 'REVOKED';
    } else if (invitation.expiresAt.getTime() <= Date.now()) {
      status = 'EXPIRED';
    }
    return {
      id: String(invitation._id),
      workspaceId: String(invitation.workspaceId),
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      status,
    };
  }
}
