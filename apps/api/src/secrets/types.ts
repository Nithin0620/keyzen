import type { SecretResolveView as SharedSecretResolveView } from '@aegis/shared';
import type { Types } from 'mongoose';
import type { EnvelopeCipherRecord } from '../crypto/envelope-cipher.service';

export interface SecretRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  description?: string;
}

export interface SecretValueRecord extends EnvelopeCipherRecord {
  _id?: Types.ObjectId;
  secretId: Types.ObjectId;
  environmentId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  valueVersion: number;
}

export interface SecretMaskedView {
  present: boolean;
  masked: string | null;
}

export interface SecretView {
  id: string;
  name: string;
  description?: string;
  value?: SecretMaskedView;
}

export interface SecretExportEntry {
  name: string;
  value: string;
}

export interface SecretHistoryView {
  version: number;
  changedBy: string;
  createdAt: string;
}

export interface SecretRollbackView {
  id: string;
  name: string;
  version: number;
}

export type SecretResolveView = SharedSecretResolveView;
