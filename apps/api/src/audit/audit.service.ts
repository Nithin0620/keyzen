import { Types } from 'mongoose';
import type { ClientSession, Model } from 'mongoose';
import type { AuditView } from '@aegis/shared';
import { currentAuditContext, type AuditContextInput } from './audit-context';
import { redactSensitive } from '../common/redact';

export interface AuditRecordInput {
  workspaceId: string;
  projectId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  actor?: AuditContextInput;
}

export interface AuditListOptions {
  projectId?: string;
  limit: number;
}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

export class AuditService {
  constructor(private readonly audits: Model<any>) {}

  async record(input: AuditRecordInput, session?: ClientSession): Promise<void> {
    const actor = input.actor ?? currentAuditContext();
    if (!actor) {
      throw new Error('Audit record requires an authenticated actor');
    }
    await this.audits.create(
      [
        {
          workspaceId: objectId(input.workspaceId),
          projectId: input.projectId ? objectId(input.projectId) : null,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: input.action,
          metadata: redactSensitive(input.metadata ?? {}),
          ipHash: actor.ipHash,
          userAgent: actor.userAgent,
        },
      ],
      { session }
    );
  }

  async list(workspaceId: string, options: AuditListOptions): Promise<AuditView[]> {
    const filter: Record<string, unknown> = { workspaceId: objectId(workspaceId) };
    if (options.projectId) {
      filter.projectId = objectId(options.projectId);
    }
    const docs = await this.audits
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .exec();
    return docs.map((doc: any) => ({
      id: String(doc._id),
      workspaceId: String(doc.workspaceId),
      projectId: doc.projectId ? String(doc.projectId) : null,
      actorType: doc.actorType,
      actorId: doc.actorId,
      action: doc.action,
      metadata: redactSensitive(doc.metadata ?? {}),
      ipHash: doc.ipHash ?? null,
      userAgent: doc.userAgent ?? null,
      createdAt: new Date(doc.createdAt).toISOString(),
    }));
  }
}
