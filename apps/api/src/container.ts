import type Redis from 'ioredis';
import mongoose, { type Connection, type Model } from 'mongoose';
import RedisClient from 'ioredis';
import { createAuditRoutes } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { AuthService } from './auth/auth.service';
import { createAuthRoutes } from './auth/auth.controller';
import { GoogleService } from './auth/google.service';
import { MailService } from './auth/mail.service';
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
  WEBHOOK_MODEL,
  WORKSPACE_MEMBER_MODEL,
  WORKSPACE_MODEL,
} from './database/schemas';
import { healthRoutes } from './health/health.controller';
import type { ManagedRoute } from './http/router';
import { createProjectRoutes } from './projects/projects.controller';
import { ProjectAccessService } from './projects/project-access.service';
import { ProjectsService } from './projects/projects.service';
import { createSecretRoutes } from './secrets/secrets.controller';
import { KeyRotationService } from './secrets/key-rotation.service';
import { createRuntimeRoutes } from './secrets/runtime.controller';
import { SecretsService } from './secrets/secrets.service';
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
}

export function buildRoutes(deps: RouteDependencies): ManagedRoute[] {
  return [
    ...healthRoutes,
    ...createAuditRoutes(deps),
    ...createAuthRoutes(deps),
    ...createWorkspaceRoutes(deps),
    ...createProjectRoutes(deps.projects),
    ...createSecretRoutes(deps),
    ...createServiceTokenRoutes(deps),
    ...createRuntimeRoutes(deps),
  ];
}

export interface Container extends RouteDependencies {
  connection: Connection;
  models: ModelMap;
  routes: ManagedRoute[];
  revocationCache: RevocationCache;
  redis?: Redis;
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
  const rateLimit = new RateLimitService();

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
  const serviceTokens = new ServiceTokenService(models[SERVICE_TOKEN_MODEL], projectAccess, revocationCache);

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
    workspaceAccess
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
    projectAccess
  );

  const secrets = new SecretsService(
    models[SECRET_MODEL],
    models[SECRET_VALUE_MODEL],
    models[SECRET_HISTORY_MODEL],
    connection,
    projectAccess,
    cipher,
    audits
  );

  const rotation = new KeyRotationService(
    models[SECRET_MODEL],
    models[SECRET_VALUE_MODEL],
    projectAccess,
    cipher,
    registry
  );

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
  };

  return {
    ...dependencies,
    connection,
    models,
    routes: buildRoutes(dependencies),
    revocationCache,
    redis,
  };
}
