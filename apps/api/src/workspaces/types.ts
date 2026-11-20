import type { MemberRole, WorkspaceRole } from '@aegis/shared';
import type { Types } from 'mongoose';

export interface WorkspaceRecord {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  ownerId: Types.ObjectId;
  settings: Record<string, string | number | boolean>;
}

export interface WorkspaceMemberRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: WorkspaceRole;
  createdAt?: Date;
}

export interface InvitationRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  email: string;
  role: MemberRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  revokedAt: Date | null;
}

export interface WorkspaceUserRecord {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  activeWorkspaceId: Types.ObjectId | null;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface TenantRecord {
  workspaceId: Types.ObjectId;
}

export interface WorkspaceView {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, string | number | boolean>;
  ownerId: string;
  role: WorkspaceRole;
  active: boolean;
}

export interface MemberView {
  userId: string;
  email: string;
  name?: string;
  role: WorkspaceRole;
  joinedAt?: string;
}

export interface InvitationView {
  id: string;
  workspaceId: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
}
