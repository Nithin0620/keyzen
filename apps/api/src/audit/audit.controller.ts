import type { RequestHandler } from 'express';
import { auditParamSchema, auditQuerySchema, type AuditQuery } from '@aegis/shared';
import { auditedRoute } from '../authz/route-manifest';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { AuditService } from './audit.service';

export function createAuditRoutes(deps: { audits: AuditService }): ManagedRoute[] {
  const list: RequestHandler = async (req, res) => {
    const query = req.query as unknown as AuditQuery;
    res.json(
      await deps.audits.list(req.params.workspaceId, {
        projectId: query.projectId,
        limit: query.limit,
      })
    );
  };

  return [
    auditedRoute({
      name: 'audit.list',
      method: 'get',
      path: '/workspaces/:workspaceId/audit',
      permission: 'audit.read',
      middlewares: [validate(auditParamSchema, 'params'), validate(auditQuerySchema, 'query')],
      handler: list,
    }),
  ];
}
