import type { RequestHandler } from 'express';
import type { WebhookCreateInput } from '@aegis/shared';
import { projectIdParamSchema, webhookCreateSchema, webhookIdParamSchema } from '@aegis/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { auditedRoute } from '../authz/route-manifest';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { WebhookService } from './webhook.service';

const BASE = '/workspaces/:workspaceId/projects/:projectId/webhooks';

interface WebhookRouteDependencies {
  webhooks: WebhookService;
}

export function createWebhookRoutes(deps: WebhookRouteDependencies): ManagedRoute[] {
  const user = (req: Parameters<RequestHandler>[0]): string => (req as AuthenticatedRequest).user.sub;
  const projectParams = [validate(projectIdParamSchema, 'params')];
  const webhookParams = [validate(webhookIdParamSchema, 'params')];

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(
      await deps.webhooks.create(user(req), req.params.workspaceId, req.params.projectId, req.body as WebhookCreateInput)
    );
  };

  const list: RequestHandler = async (req, res) => {
    res.json(await deps.webhooks.list(user(req), req.params.workspaceId, req.params.projectId));
  };

  const rotate: RequestHandler = async (req, res) => {
    res.json(
      await deps.webhooks.rotateSecret(user(req), req.params.workspaceId, req.params.projectId, req.params.webhookId)
    );
  };

  const deactivate: RequestHandler = async (req, res) => {
    res.json(
      await deps.webhooks.deactivate(user(req), req.params.workspaceId, req.params.projectId, req.params.webhookId)
    );
  };

  const deliveries: RequestHandler = async (req, res) => {
    res.json(
      await deps.webhooks.deliveries(user(req), req.params.workspaceId, req.params.projectId, req.params.webhookId)
    );
  };

  return [
    auditedRoute({ name: 'webhooks.create', method: 'post', path: BASE, permission: 'webhooks.manage', middlewares: [...projectParams, validate(webhookCreateSchema)], handler: create }),
    auditedRoute({ name: 'webhooks.list', method: 'get', path: BASE, permission: 'webhooks.manage', middlewares: projectParams, handler: list }),
    auditedRoute({ name: 'webhooks.rotateSecret', method: 'post', path: `${BASE}/:webhookId/rotate-secret`, permission: 'webhooks.manage', middlewares: webhookParams, handler: rotate }),
    auditedRoute({ name: 'webhooks.deactivate', method: 'delete', path: `${BASE}/:webhookId`, permission: 'webhooks.manage', middlewares: webhookParams, handler: deactivate }),
    auditedRoute({ name: 'webhooks.deliveries', method: 'get', path: `${BASE}/:webhookId/deliveries`, permission: 'webhooks.manage', middlewares: webhookParams, handler: deliveries }),
  ];
}
