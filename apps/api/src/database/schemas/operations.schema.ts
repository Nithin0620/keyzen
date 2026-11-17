import { Schema } from 'mongoose';
import { USER_MODEL } from './identity.schema';
import { PROJECT_MODEL, ENVIRONMENT_MODEL } from './project.schema';
import { WORKSPACE_MODEL } from './workspace.schema';

export const SERVICE_TOKEN_MODEL = 'ServiceToken';
export const AUDIT_LOG_MODEL = 'AuditLog';
export const WEBHOOK_MODEL = 'Webhook';
export const SUBSCRIPTION_MODEL = 'Subscription';

export const ServiceTokenSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, required: true, index: true },
    environmentId: { type: Schema.Types.ObjectId, ref: ENVIRONMENT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    tokenHash: { type: String, required: true, unique: true },
    tokenPrefix: { type: String, required: true, maxlength: 32 },
    createdBy: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE', required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

export const AuditLogSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, default: null },
    actorType: { type: String, enum: ['USER', 'SERVICE_TOKEN', 'SYSTEM'], required: true },
    actorId: { type: String, required: true, maxlength: 120 },
    action: { type: String, required: true, maxlength: 120 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipHash: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 500 },
  },
  { timestamps: true, strict: true }
);

AuditLogSchema.index({ workspaceId: 1, createdAt: -1 });
AuditLogSchema.index({ projectId: 1, createdAt: -1 });

export const WebhookSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    url: { type: String, required: true, maxlength: 2048 },
    events: { type: [String], required: true, default: [] },
    secretHash: { type: String, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, strict: true }
);

export const SubscriptionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, unique: true },
    stripeCustomerId: { type: String, sparse: true, unique: true },
    stripeSubscriptionId: { type: String, sparse: true, unique: true },
    plan: { type: String, enum: ['FREE', 'PRO', 'ENTERPRISE'], default: 'FREE', required: true },
    status: { type: String, enum: ['ACTIVE', 'CANCELED', 'PAST_DUE'], default: 'ACTIVE', required: true },
    currentPeriodEnd: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);
