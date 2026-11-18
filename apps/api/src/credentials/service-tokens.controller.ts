import type { RequestHandler } from 'express';
import {
  projectIdParamSchema,
  serviceTokenIdParamSchema,
  serviceTokenRotateSchema,
  serviceTokenSchema,
  type ServiceTokenInput,
  type ServiceTokenRotateInput,
} from '@aegis/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { auditedRoute } from '../authz/route-manifest';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { ServiceTokenService } from './service-token.service';

const BASE = '/workspaces/:workspaceId/projects/:projectId/credentials';

interface ServiceTokenRouteDependencies {
  serviceTokens: ServiceTokenService;
}

export function createServiceTokenRoutes(deps: ServiceTokenRouteDependencies): ManagedRoute[] {
  const user = (req: Parameters<RequestHandler>[0]): string => (req as AuthenticatedRequest).user.sub;
  const projectParams = [validate(projectIdParamSchema, 'params')];
  const tokenParams = [validate(serviceTokenIdParamSchema, 'params')];

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(
      await deps.serviceTokens.create(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.body as ServiceTokenInput
      )
    );
  };

  const list: RequestHandler = async (req, res) => {
    res.json(await deps.serviceTokens.list(user(req), req.params.workspaceId, req.params.projectId));
  };

  const rotate: RequestHandler = async (req, res) => {
    res.json(
      await deps.serviceTokens.rotate(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.tokenId,
        (req.body as ServiceTokenRotateInput).expiresInDays
      )
    );
  };

  const revoke: RequestHandler = async (req, res) => {
    res.json(
      await deps.serviceTokens.revoke(user(req), req.params.workspaceId, req.params.projectId, req.params.tokenId)
    );
  };

  return [
    auditedRoute({ name: 'credentials.create', method: 'post', path: BASE, permission: 'credentials.manage', middlewares: [...projectParams, validate(serviceTokenSchema)], handler: create }),
    auditedRoute({ name: 'credentials.list', method: 'get', path: BASE, permission: 'credentials.manage', middlewares: projectParams, handler: list }),
    auditedRoute({ name: 'credentials.rotate', method: 'post', path: `${BASE}/:tokenId/rotate`, permission: 'credentials.manage', middlewares: [...tokenParams, validate(serviceTokenRotateSchema)], handler: rotate }),
    auditedRoute({ name: 'credentials.revoke', method: 'post', path: `${BASE}/:tokenId/revoke`, permission: 'credentials.manage', middlewares: tokenParams, handler: revoke }),
  ];
}
