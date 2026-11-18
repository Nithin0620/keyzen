import type { Schema } from 'mongoose';
import * as identity from './identity.schema';
import * as workspace from './workspace.schema';
import * as project from './project.schema';
import * as secret from './secret.schema';
import * as operations from './operations.schema';
import * as version from './schema-version.schema';

export * from './identity.schema';
export * from './workspace.schema';
export * from './project.schema';
export * from './secret.schema';
export * from './operations.schema';
export * from './schema-version.schema';

export interface ModelDefinition {
  name: string;
  schema: Schema;
}

export const modelDefinitions: ModelDefinition[] = [
  { name: identity.USER_MODEL, schema: identity.UserSchema },
  { name: identity.OAUTH_ACCOUNT_MODEL, schema: identity.OAuthAccountSchema },
  { name: identity.SESSION_MODEL, schema: identity.SessionSchema },
  { name: identity.VERIFICATION_TOKEN_MODEL, schema: identity.VerificationTokenSchema },
  { name: workspace.WORKSPACE_MODEL, schema: workspace.WorkspaceSchema },
  { name: workspace.WORKSPACE_MEMBER_MODEL, schema: workspace.WorkspaceMemberSchema },
  { name: workspace.INVITATION_MODEL, schema: workspace.InvitationSchema },
  { name: project.PROJECT_MODEL, schema: project.ProjectSchema },
  { name: project.PROJECT_MEMBER_MODEL, schema: project.ProjectMemberSchema },
  { name: project.ENVIRONMENT_MODEL, schema: project.EnvironmentSchema },
  { name: secret.SECRET_MODEL, schema: secret.SecretSchema },
  { name: secret.SECRET_VALUE_MODEL, schema: secret.SecretValueSchema },
  { name: secret.SECRET_HISTORY_MODEL, schema: secret.SecretHistorySchema },
  { name: operations.SERVICE_TOKEN_MODEL, schema: operations.ServiceTokenSchema },
  { name: operations.AUDIT_LOG_MODEL, schema: operations.AuditLogSchema },
  { name: operations.WEBHOOK_MODEL, schema: operations.WebhookSchema },
  { name: operations.WEBHOOK_DELIVERY_MODEL, schema: operations.WebhookDeliverySchema },
  { name: operations.PROCESSED_STRIPE_EVENT_MODEL, schema: operations.ProcessedStripeEventSchema },
  { name: operations.SUBSCRIPTION_MODEL, schema: operations.SubscriptionSchema },
  { name: version.SCHEMA_VERSION_MODEL, schema: version.SchemaVersionSchema },
];
