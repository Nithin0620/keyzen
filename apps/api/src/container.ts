import type Redis from 'ioredis';
import mongoose, { type Connection, type Model } from 'mongoose';
import RedisClient from 'ioredis';
import { docsRoutes } from './docs/docs.controller';
import { createAuditRoutes } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { createBillingRoutes } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { StripeSdkEventVerifier } from './billing/stripe-event-verifier';
import { StripeGateway } from './billing/stripe.gateway';
import { AuthService } from './auth/auth.service';
import { createAuthRoutes } from './auth/auth.controller';
import { GoogleService } from './auth/google.service';
import { MailService } from './auth/mail.service';
import { AbuseMonitor } from './auth/abuse-monitor.service';
import { RateLimitService } from './auth/rate-limit.service';
import { TokenService } from './auth/token.service';
import { PolicyService } from './authz/policy.service';
import { validateEnv } from './config/env';
import { InMemoryRevocationCache, RedisRevocationCache, type RevocationCache } from './credentials/revocation-cache';
import { ServiceTokenService } from './credentials/service-token.service';
import { createServiceTokenRoutes } from './credentials/service-tokens.controller';
import { EnvelopeCipherService } from './crypto/envelope-cipher.service';
import { EnvKeyProvider } from './crypto/env-key.provider';
import type { KeyProvider } from './crypto/key-provider';
import { KeyProviderRegistry } from './crypto/key-provider.registry';
import { KmsKeyProvider } from './crypto/kms-key.provider';
import { ValueCipherService } from './crypto/value-cipher.service';
import { modelDefinitions } from './database/schemas';
import {
  AUDIT_LOG_MODEL,
  ENVIRONMENT_MODEL,
  INVITATION_MODEL,
  OAUTH_ACCOUNT_MODEL,
  PROCESSED_STRIPE_EVENT_MODEL,
  PROJECT_MEMBER_MODEL,
  PROJECT_MODEL,
  SECRET_HISTORY_MODEL,
  SECRET_MODEL,
  SECRET_VALUE_MODEL,
  SERVICE_TOKEN_MODEL,
  SESSION_MODEL,
  SUBSCRIPTION_MODEL,
  USER_MODEL,
  VERIFICATION_TOKEN_MODEL,
  WEBHOOK_DELIVERY_MODEL,
  WEBHOOK_MODEL,
  WORKSPACE_MEMBER_MODEL,
  WORKSPACE_MODEL,
} from './database/schemas';
import { createHealthRoutes } from './health/health.controller';
import type { ManagedRoute } from './http/router';
import { BackgroundJobs } from './jobs/background-jobs';
import { JobScheduler, type ScheduledJob } from './jobs/job-scheduler';
import { createProjectRoutes } from './projects/projects.controller';
import { ProjectAccessService } from './projects/project-access.service';
import { ProjectsService } from './projects/projects.service';
import { createSecretRoutes } from './secrets/secrets.controller';
import { KeyRotationService } from './secrets/key-rotation.service';
import { createRuntimeRoutes } from './secrets/runtime.controller';
import { SecretsService } from './secrets/secrets.service';
import { WebhookDispatcher } from './webhooks/webhook-dispatcher';
import { WebhookSecretCipher } from './webhooks/webhook-secret.cipher';
import { WebhookService } from './webhooks/webhook.service';
import { createWebhookRoutes } from './webhooks/webhooks.controller';
import { createWorkspaceRoutes } from './workspaces/workspaces.controller';
import { WorkspaceAccessService } from './workspaces/workspace-access.service';
import { WorkspacesService } from './workspaces/workspaces.service';

export type ModelMap = Record<string, Model<any>>;

export interface RouteDependencies {
  audits: AuditService;
  tokens: TokenService;
  policy: PolicyService;
  auth: AuthService;
  google: GoogleService;
  rateLimit: RateLimitService;
  workspaces: WorkspacesService;
  projects: ProjectsService;
  secrets: SecretsService;
  rotation: KeyRotationService;
  serviceTokens: ServiceTokenService;
  billing?: BillingService;
  webhooks?: WebhookService;
  connection?: Connection;
  redis?: Redis;
}

export function buildRoutes(deps: RouteDependencies): ManagedRoute[] {
  return [
    ...createHealthRoutes({ connection: deps.connection, redis: deps.redis }),
    ...docsRoutes,
    ...createAuditRoutes(deps),
    ...createAuthRoutes(deps),
    ...createWorkspaceRoutes(deps),
    ...createProjectRoutes(deps.projects),
    ...createSecretRoutes(deps),
    ...createServiceTokenRoutes(deps),
    ...createRuntimeRoutes(deps),
    ...createWebhookRoutes({ webhooks: deps.webhooks! }),
    ...createBillingRoutes({ billing: deps.billing! }),
  ];
}

export interface Container extends RouteDependencies {
  connection: Connection;
  models: ModelMap;
  routes: ManagedRoute[];
  revocationCache: RevocationCache;
  redis?: Redis;
  mail: MailService;
  jobs: JobScheduler;
  jobDefinitions: ScheduledJob[];
}

export async function createContainer(): Promise<Container> {
  const env = validateEnv();
  const connection = mongoose.createConnection(env.MONGODB_URI);
  await connection.asPromise();

  const models: ModelMap = {};
  for (const definition of modelDefinitions) {
    models[definition.name] = connection.model(definition.name, definition.schema);
  }

  const audits = new AuditService(models[AUDIT_LOG_MODEL]);
  const tokens = new TokenService();
  const mail = new MailService();
  const google = new GoogleService();
  const abuseMonitor = new AbuseMonitor(mail, env.ABUSE_ALERT_THRESHOLD, env.ABUSE_ALERT_WINDOW_MS);
  const rateLimit = new RateLimitService(abuseMonitor);

  const auth = new AuthService(
    models[USER_MODEL],
    models[SESSION_MODEL],
    models[VERIFICATION_TOKEN_MODEL],
    models[OAUTH_ACCOUNT_MODEL],
    connection,
    tokens,
    mail
  );

  const policy = new PolicyService(
    models[USER_MODEL],
    models[WORKSPACE_MEMBER_MODEL],
    models[PROJECT_MODEL],
    models[PROJECT_MEMBER_MODEL]
  );

  const workspaceAccess = new WorkspaceAccessService(models[WORKSPACE_MEMBER_MODEL], models[USER_MODEL]);
  const projectAccess = new ProjectAccessService(
    models[USER_MODEL],
    models[WORKSPACE_MEMBER_MODEL],
    models[PROJECT_MODEL],
    models[PROJECT_MEMBER_MODEL],
    models[ENVIRONMENT_MODEL]
  );

  const redis = env.NODE_ENV === 'production' ? new RedisClient(env.REDIS_URL, { lazyConnect: true }) : undefined;
  const revocationCache = redis ? new RedisRevocationCache(redis) : new InMemoryRevocationCache();

  const keyProviders: KeyProvider[] = [];
  if (env.AEGIS_KMS_KEY_ID) {
    keyProviders.push(new KmsKeyProvider(env.AEGIS_KMS_KEY_ID));
  }
  if (env.AEGIS_MASTER_KEY) {
    keyProviders.push(new EnvKeyProvider(env.AEGIS_MASTER_KEY));
  }
  const registry = new KeyProviderRegistry(keyProviders);
  const legacyCipher = new ValueCipherService(env.AEGIS_MASTER_KEY);
  const cipher = new EnvelopeCipherService(registry, legacyCipher);

  const secretCipher = new WebhookSecretCipher();
  const webhookDispatcher = new WebhookDispatcher(
    models[WEBHOOK_MODEL],
    models[WEBHOOK_DELIVERY_MODEL],
    secretCipher
  );
  const webhooks = new WebhookService(models[WEBHOOK_MODEL], secretCipher, webhookDispatcher, projectAccess);
  const serviceTokens = new ServiceTokenService(
    models[SERVICE_TOKEN_MODEL],
    projectAccess,
    revocationCache,
    webhookDispatcher
  );

  const workspaces = new WorkspacesService(
    models[USER_MODEL],
    models[WORKSPACE_MODEL],
    models[WORKSPACE_MEMBER_MODEL],
    models[INVITATION_MODEL],
    models[PROJECT_MODEL],
    models[PROJECT_MEMBER_MODEL],
    models[ENVIRONMENT_MODEL],
    models[SECRET_MODEL],
    models[SECRET_VALUE_MODEL],
    models[SECRET_HISTORY_MODEL],
    models[SERVICE_TOKEN_MODEL],
    models[AUDIT_LOG_MODEL],
    models[WEBHOOK_MODEL],
    models[SUBSCRIPTION_MODEL],
    connection,
    mail,
    workspaceAccess,
    models[WEBHOOK_DELIVERY_MODEL],
    models[PROCESSED_STRIPE_EVENT_MODEL]
  );

  const projects = new ProjectsService(
    models[USER_MODEL],
    models[PROJECT_MODEL],
    models[PROJECT_MEMBER_MODEL],
    models[ENVIRONMENT_MODEL],
    models[SECRET_MODEL],
    models[SECRET_VALUE_MODEL],
    models[SECRET_HISTORY_MODEL],
    models[SERVICE_TOKEN_MODEL],
    models[AUDIT_LOG_MODEL],
    models[WEBHOOK_MODEL],
    connection,
    cipher,
    projectAccess,
    models[WEBHOOK_DELIVERY_MODEL]
  );

  const secrets = new SecretsService(
    models[SECRET_MODEL],
    models[SECRET_VALUE_MODEL],
    models[SECRET_HISTORY_MODEL],
    connection,
    projectAccess,
    cipher,
    audits,
    webhookDispatcher
  );

  const rotation = new KeyRotationService(
    models[SECRET_MODEL],
    models[SECRET_VALUE_MODEL],
    projectAccess,
    cipher,
    registry
  );

  const stripeGateway = new StripeGateway(env.STRIPE_SECRET_KEY);
  const stripeVerifier =
    env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
      ? new StripeSdkEventVerifier(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
      : undefined;
  const billing = new BillingService(
    models[SUBSCRIPTION_MODEL],
    models[PROCESSED_STRIPE_EVENT_MODEL],
    workspaceAccess,
    audits,
    stripeGateway,
    stripeVerifier
  );

  const backgroundJobs = new BackgroundJobs(
    models[SERVICE_TOKEN_MODEL],
    models[INVITATION_MODEL],
    models[AUDIT_LOG_MODEL],
    rotation,
    webhookDispatcher,
    mail
  );
  const jobDefinitions = backgroundJobs.jobs();
  const jobs = new JobScheduler(mail, redis);

  const dependencies: RouteDependencies = {
    audits,
    tokens,
    policy,
    auth,
    google,
    rateLimit,
    workspaces,
    projects,
    secrets,
    rotation,
    serviceTokens,
    billing,
    webhooks,
    connection,
    redis,
  };

  return {
    ...dependencies,
    connection,
    models,
    routes: buildRoutes(dependencies),
    revocationCache,
    redis,
    mail,
    jobs,
    jobDefinitions,
  };
}
