import type { Types } from 'mongoose';
import type { Permission, ProjectRole } from '@aegis/shared';
import type { EnvelopeCipherRecord } from '../crypto/envelope-cipher.service';

export interface ProjectRecord {
  workspaceId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, string | number | boolean>;
  archivedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectMemberRecord {
  projectId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ProjectRole;
  customPermissions: Permission[];
}

export interface EnvironmentRecord {
  projectId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  slug: string;
  archivedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SecretRecord {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
}

export interface SecretValueRecord extends EnvelopeCipherRecord {
  secretId: Types.ObjectId;
  environmentId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  valueVersion: number;
}

export interface ProjectSummary {
  secrets: number;
  environments: number;
  members: number;
  secretValues: number;
  lastActivityAt: string | null;
}

export interface ProjectView {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, string | number | boolean>;
  archived: boolean;
  summary: ProjectSummary;
}

export interface ProjectMemberView {
  userId: string;
  email: string;
  role: ProjectRole;
  customPermissions: Permission[];
}

export interface EnvironmentView {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  archived: boolean;
}

export interface DiffEntryView {
  name: string;
  status: 'SAME' | 'DIFFERENT' | 'ONLY_LEFT' | 'ONLY_RIGHT';
  left: { present: boolean; masked: string | null };
  right: { present: boolean; masked: string | null };
}
