import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { USER_MODEL, WORKSPACE_MEMBER_MODEL } from '../database/schemas';
import type { WorkspaceMemberRecord, WorkspaceUserRecord } from './types';

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new NotFoundException();
  }
  return new Types.ObjectId(value);
}

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @InjectModel(WORKSPACE_MEMBER_MODEL) private readonly members: Model<WorkspaceMemberRecord>,
    @InjectModel(USER_MODEL) private readonly users: Model<WorkspaceUserRecord>
  ) {}

  async requireMember(userId: string, workspaceId: string): Promise<WorkspaceMemberRecord> {
    const user = await this.users.findById(objectId(userId)).exec();
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException();
    }
    const member = await this.members
      .findOne({ workspaceId: objectId(workspaceId), userId: objectId(userId) })
      .exec();
    if (!member) {
      throw new ForbiddenException('Workspace access denied');
    }
    return member;
  }

  async requireAdmin(userId: string, workspaceId: string): Promise<WorkspaceMemberRecord> {
    const member = await this.requireMember(userId, workspaceId);
    if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
      throw new ForbiddenException('Workspace admin access required');
    }
    return member;
  }

  async requireOwner(userId: string, workspaceId: string): Promise<WorkspaceMemberRecord> {
    const member = await this.requireMember(userId, workspaceId);
    if (member.role !== 'OWNER') {
      throw new ForbiddenException('Workspace owner access required');
    }
    return member;
  }
}
