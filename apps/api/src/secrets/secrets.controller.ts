import type { RequestHandler } from 'express';
import {
  envExportQuerySchema,
  envImportSchema,
  keyRotationSchema,
  projectIdParamSchema,
  secretCreateSchema,
  secretGetQuerySchema,
  secretHistoryQuerySchema,
  secretListQuerySchema,
  secretParamSchema,
  secretRevealQuerySchema,
  secretRollbackSchema,
  secretUpdateSchema,
  secretValueUpsertSchema,
  environmentSecretParamSchema,
  typedConfirmationSchema,
  type EnvExportQuery,
  type EnvImportInput,
  type KeyRotationInput,
  type SecretCreateInput,
  type SecretGetQuery,
  type SecretHistoryQuery,
  type SecretListQuery,
  type SecretRollbackInput,
  type SecretUpdateInput,
  type SecretValueUpsertInput,
  type TypedConfirmationInput,
} from '@aegis/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { auditedRoute } from '../authz/route-manifest';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { KeyRotationService } from './key-rotation.service';
import type { SecretsService } from './secrets.service';

const BASE = '/workspaces/:workspaceId/projects/:projectId/secrets';

interface SecretRouteDependencies {
  secrets: SecretsService;
  rotation: KeyRotationService;
}

export function createSecretRoutes(deps: SecretRouteDependencies): ManagedRoute[] {
  const user = (req: Parameters<RequestHandler>[0]): string => (req as AuthenticatedRequest).user.sub;
  const projectParams = [validate(projectIdParamSchema, 'params')];
  const secretParams = [validate(secretParamSchema, 'params')];

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(
      await deps.secrets.create(user(req), req.params.workspaceId, req.params.projectId, req.body as SecretCreateInput)
    );
  };

  const list: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.list(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.query as unknown as SecretListQuery
      )
    );
  };

  const importEnv: RequestHandler = async (req, res) => {
    res.status(201).json(
      await deps.secrets.import(user(req), req.params.workspaceId, req.params.projectId, req.body as EnvImportInput)
    );
  };

  const exportEnv: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.export(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        (req.query as EnvExportQuery).environmentId
      )
    );
  };

  const rotateKeys: RequestHandler = async (req, res) => {
    res.status(201).json(
      await deps.rotation.rotateProjectKeys(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        (req.body as KeyRotationInput).targetKeyId
      )
    );
  };

  const get: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.get(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        (req.query as SecretGetQuery).environmentId
      )
    );
  };

  const reveal: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.reveal(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        (req.query as { environmentId: string }).environmentId
      )
    );
  };

  const history: RequestHandler = async (req, res) => {
    const query = req.query as unknown as SecretHistoryQuery;
    res.json(
      await deps.secrets.history(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        query.environmentId,
        query.limit
      )
    );
  };

  const rollback: RequestHandler = async (req, res) => {
    const body = req.body as SecretRollbackInput;
    res.json(
      await deps.secrets.rollback(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        req.params.environmentId,
        body.version,
        body.confirmation
      )
    );
  };

  const update: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.update(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        req.body as SecretUpdateInput
      )
    );
  };

  const upsertValue: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.upsertValue(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        req.params.environmentId,
        req.body as SecretValueUpsertInput
      )
    );
  };

  const remove: RequestHandler = async (req, res) => {
    res.json(
      await deps.secrets.remove(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.secretId,
        (req.body as TypedConfirmationInput).confirmation
      )
    );
  };

  return [
    auditedRoute({ name: 'secrets.create', method: 'post', path: BASE, permission: 'secrets.create', middlewares: [...projectParams, validate(secretCreateSchema)], handler: create }),
    auditedRoute({ name: 'secrets.list', method: 'get', path: BASE, permission: 'secrets.read', middlewares: [...projectParams, validate(secretListQuerySchema, 'query')], handler: list }),
    auditedRoute({ name: 'secrets.import', method: 'post', path: `${BASE}/import`, permission: 'secrets.create', middlewares: [...projectParams, validate(envImportSchema)], handler: importEnv }),
    auditedRoute({ name: 'secrets.export', method: 'get', path: `${BASE}/export`, permission: 'secrets.export', middlewares: [...projectParams, validate(envExportQuerySchema, 'query')], handler: exportEnv }),
    auditedRoute({ name: 'secrets.rotateKeys', method: 'post', path: `${BASE}/keys/rotate`, permission: 'secrets.update', middlewares: [...projectParams, validate(keyRotationSchema)], handler: rotateKeys }),
    auditedRoute({ name: 'secrets.get', method: 'get', path: `${BASE}/:secretId`, permission: 'secrets.read', middlewares: [...secretParams, validate(secretGetQuerySchema, 'query')], handler: get }),
    auditedRoute({ name: 'secrets.reveal', method: 'get', path: `${BASE}/:secretId/reveal`, permission: 'secrets.read', middlewares: [...secretParams, validate(secretRevealQuerySchema, 'query')], handler: reveal }),
    auditedRoute({ name: 'secrets.history', method: 'get', path: `${BASE}/:secretId/history`, permission: 'secrets.read', middlewares: [...secretParams, validate(secretHistoryQuerySchema, 'query')], handler: history }),
    auditedRoute({ name: 'secrets.rollback', method: 'post', path: `${BASE}/:secretId/environments/:environmentId/rollback`, permission: 'secrets.update', middlewares: [validate(environmentSecretParamSchema, 'params'), validate(secretRollbackSchema)], handler: rollback }),
    auditedRoute({ name: 'secrets.update', method: 'patch', path: `${BASE}/:secretId`, permission: 'secrets.update', middlewares: [...secretParams, validate(secretUpdateSchema)], handler: update }),
    auditedRoute({ name: 'secrets.upsertValue', method: 'put', path: `${BASE}/:secretId/environments/:environmentId/value`, permission: 'secrets.update', middlewares: [validate(environmentSecretParamSchema, 'params'), validate(secretValueUpsertSchema)], handler: upsertValue }),
    auditedRoute({ name: 'secrets.remove', method: 'delete', path: `${BASE}/:secretId`, permission: 'secrets.delete', middlewares: [...secretParams, validate(typedConfirmationSchema)], handler: remove }),
  ];
}
