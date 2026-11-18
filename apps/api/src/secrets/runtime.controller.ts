import type { RequestHandler } from 'express';
import { secretResolveSchema, type SecretResolveInput } from '@aegis/shared';
import { AUTHENTICATED, defineRoute } from '../authz/route-manifest';
import { UnauthorizedException } from '../common/http-error';
import { validate } from '../common/zod-validation.pipe';
import { validateEnv } from '../config/env';
import type { RateLimitService } from '../auth/rate-limit.service';
import type { ManagedRoute } from '../http/router';
import type { SecretsService } from './secrets.service';
import type { ServiceTokenIdentity } from '../credentials/service-token.service';
import type { ServiceTokenRequest } from '../credentials/service-token.guard';

interface RuntimeRouteDependencies {
  secrets: SecretsService;
  rateLimit: RateLimitService;
}

function tokenIdentity(req: Parameters<RequestHandler>[0]): ServiceTokenIdentity {
  const identity = (req as ServiceTokenRequest).serviceToken;
  if (!identity) {
    throw new UnauthorizedException();
  }
  return identity;
}

export function createRuntimeRoutes(deps: RuntimeRouteDependencies): ManagedRoute[] {
  const resolve: RequestHandler = async (req, res) => {
    const env = validateEnv();
    const token = tokenIdentity(req);
    deps.rateLimit.check(
      `resolve:${token.id}`,
      env.SERVICE_TOKEN_RATE_LIMIT,
      env.SERVICE_TOKEN_RATE_WINDOW_MS
    );
    const body = req.body as SecretResolveInput;
    res.json(await deps.secrets.resolve(token.workspaceId, token.projectId, token.environmentId, body.names));
  };

  const validateToken: RequestHandler = async (req, res) => {
    const env = validateEnv();
    const token = tokenIdentity(req);
    deps.rateLimit.check(
      `validate:${token.id}`,
      env.SERVICE_TOKEN_RATE_LIMIT,
      env.SERVICE_TOKEN_RATE_WINDOW_MS
    );
    await deps.secrets.validate(token.workspaceId, token.projectId, token.environmentId);
    res.json({
      valid: true,
      workspaceId: token.workspaceId,
      projectId: token.projectId,
      environmentId: token.environmentId,
      expiresAt: token.expiresAt,
    });
  };

  return [
    defineRoute({
      name: 'runtime.resolve',
      method: 'post',
      path: '/v1/secrets/resolve',
      auth: 'serviceToken',
      permission: AUTHENTICATED,
      audit: 'read',
      middlewares: [validate(secretResolveSchema)],
      handler: resolve,
    }),
    defineRoute({
      name: 'runtime.validate',
      method: 'get',
      path: '/v1/validate',
      auth: 'serviceToken',
      permission: AUTHENTICATED,
      audit: 'read',
      handler: validateToken,
    }),
  ];
}
