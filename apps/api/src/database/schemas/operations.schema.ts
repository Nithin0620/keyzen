import { Schema } from 'mongoose';
import { USER_MODEL } from './identity.schema';
import { PROJECT_MODEL, ENVIRONMENT_MODEL } from './project.schema';
import { WORKSPACE_MODEL } from './workspace.schema';

export const SERVICE_TOKEN_MODEL = 'ServiceToken';
export const AUDIT_LOG_MODEL = 'AuditLog';
export const WEBHOOK_MODEL = 'Webhook';
export const WEBHOOK_DELIVERY_MODEL = 'WebhookDelivery';
export const PROCESSED_STRIPE_EVENT_MODEL = 'ProcessedStripeEvent';
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
    signingSecret: {
      ciphertext: { type: String, required: true },
      iv: { type: String, required: true },
      authTag: { type: String, required: true },
      keyId: { type: String, required: true },
    },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true, strict: true }
);

export const WebhookDeliverySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, required: true, index: true },
    webhookId: { type: Schema.Types.ObjectId, ref: WEBHOOK_MODEL, required: true, index: true },
    eventId: { type: String, required: true },
    event: { type: String, required: true, maxlength: 80 },
    status: { type: String, enum: ['PENDING', 'DELIVERED', 'FAILED'], default: 'PENDING', required: true },
    attempts: { type: Number, min: 0, default: 0, required: true },
    nextAttemptAt: { type: Date, default: null },
    responseStatus: { type: Number, default: null },
    error: { type: String, default: null, maxlength: 500 },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: true }
);

WebhookDeliverySchema.index({ workspaceId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ projectId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

export const ProcessedStripeEventSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true, maxlength: 120 },
    expiresAt: { type: Date, required: true, expires: 0 },
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
