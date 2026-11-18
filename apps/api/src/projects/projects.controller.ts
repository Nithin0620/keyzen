import type { RequestHandler } from 'express';
import {
  diffParamSchema,
  environmentCreateSchema,
  environmentDuplicateSchema,
  environmentIdParamSchema,
  environmentUpdateSchema,
  projectCreateSchema,
  projectIdParamSchema,
  memberIdParamSchema,
  projectMemberCreateSchema,
  projectMemberRoleUpdateSchema,
  projectUpdateSchema,
  typedConfirmationSchema,
  workspaceIdParamSchema,
  type EnvironmentCreateInput,
  type EnvironmentDuplicateInput,
  type EnvironmentUpdateInput,
  type ProjectCreateInput,
  type ProjectMemberCreateInput,
  type ProjectMemberRoleUpdateInput,
  type ProjectUpdateInput,
  type TypedConfirmationInput,
} from '@aegis/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AUTHENTICATED, auditedRoute } from '../authz/route-manifest';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { ProjectsService } from './projects.service';

const BASE = '/workspaces/:workspaceId/projects';

export function createProjectRoutes(projects: ProjectsService): ManagedRoute[] {
  const user = (req: Parameters<RequestHandler>[0]): string => (req as AuthenticatedRequest).user.sub;

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await projects.create(user(req), req.params.workspaceId, req.body as ProjectCreateInput));
  };

  const list: RequestHandler = async (req, res) => {
    res.json(await projects.list(user(req), req.params.workspaceId));
  };

  const get: RequestHandler = async (req, res) => {
    res.json(await projects.get(user(req), req.params.workspaceId, req.params.projectId));
  };

  const update: RequestHandler = async (req, res) => {
    res.json(
      await projects.update(user(req), req.params.workspaceId, req.params.projectId, req.body as ProjectUpdateInput)
    );
  };

  const remove: RequestHandler = async (req, res) => {
    res.json(
      await projects.remove(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        (req.body as TypedConfirmationInput).confirmation
      )
    );
  };

  const archive: RequestHandler = async (req, res) => {
    res.json(await projects.archive(user(req), req.params.workspaceId, req.params.projectId));
  };

  const restore: RequestHandler = async (req, res) => {
    res.json(await projects.restore(user(req), req.params.workspaceId, req.params.projectId));
  };

  const members: RequestHandler = async (req, res) => {
    res.json(await projects.listMembers(user(req), req.params.workspaceId, req.params.projectId));
  };

  const addMember: RequestHandler = async (req, res) => {
    res.status(201).json(
      await projects.addMember(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.body as ProjectMemberCreateInput
      )
    );
  };

  const changeMemberRole: RequestHandler = async (req, res) => {
    res.json(
      await projects.changeMemberRole(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.userId,
        req.body as ProjectMemberRoleUpdateInput
      )
    );
  };

  const removeMember: RequestHandler = async (req, res) => {
    res.json(
      await projects.removeMember(user(req), req.params.workspaceId, req.params.projectId, req.params.userId)
    );
  };

  const environments: RequestHandler = async (req, res) => {
    res.json(await projects.listEnvironments(user(req), req.params.workspaceId, req.params.projectId));
  };

  const createEnvironment: RequestHandler = async (req, res) => {
    res.status(201).json(
      await projects.createEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.body as EnvironmentCreateInput
      )
    );
  };

  const environment: RequestHandler = async (req, res) => {
    res.json(
      await projects.getEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId
      )
    );
  };

  const updateEnvironment: RequestHandler = async (req, res) => {
    res.json(
      await projects.updateEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId,
        req.body as EnvironmentUpdateInput
      )
    );
  };

  const removeEnvironment: RequestHandler = async (req, res) => {
    res.json(
      await projects.removeEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId,
        (req.body as TypedConfirmationInput).confirmation
      )
    );
  };

  const archiveEnvironment: RequestHandler = async (req, res) => {
    res.json(
      await projects.archiveEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId
      )
    );
  };

  const restoreEnvironment: RequestHandler = async (req, res) => {
    res.json(
      await projects.restoreEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId
      )
    );
  };

  const duplicateEnvironment: RequestHandler = async (req, res) => {
    res.json(
      await projects.duplicateEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId,
        req.body as EnvironmentDuplicateInput
      )
    );
  };

  const diff: RequestHandler = async (req, res) => {
    res.json(
      await projects.diffEnvironments(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.fromEnvironmentId,
        req.params.toEnvironmentId
      )
    );
  };

  const resolve: RequestHandler = async (req, res) => {
    res.json(
      await projects.resolveEnvironment(
        user(req),
        req.params.workspaceId,
        req.params.projectId,
        req.params.environmentId
      )
    );
  };

  const projectParams = [validate(projectIdParamSchema, 'params')];
  const environmentParams = [validate(environmentIdParamSchema, 'params')];
  const memberRoleParams = [validate(memberIdParamSchema, 'params')];

  return [
    auditedRoute({ name: 'projects.create', method: 'post', path: BASE, permission: AUTHENTICATED, middlewares: [validate(workspaceIdParamSchema, 'params'), validate(projectCreateSchema)], handler: create }),
    auditedRoute({ name: 'projects.list', method: 'get', path: BASE, permission: AUTHENTICATED, middlewares: [validate(workspaceIdParamSchema, 'params')], handler: list }),
    auditedRoute({ name: 'projects.get', method: 'get', path: `${BASE}/:projectId`, permission: AUTHENTICATED, middlewares: projectParams, handler: get }),
    auditedRoute({ name: 'projects.update', method: 'patch', path: `${BASE}/:projectId`, permission: 'environments.manage', middlewares: [...projectParams, validate(projectUpdateSchema)], handler: update }),
    auditedRoute({ name: 'projects.remove', method: 'delete', path: `${BASE}/:projectId`, permission: 'environments.manage', middlewares: [...projectParams, validate(typedConfirmationSchema)], handler: remove }),
    auditedRoute({ name: 'projects.archive', method: 'post', path: `${BASE}/:projectId/archive`, permission: 'environments.manage', middlewares: projectParams, handler: archive }),
    auditedRoute({ name: 'projects.restore', method: 'post', path: `${BASE}/:projectId/restore`, permission: 'environments.manage', middlewares: projectParams, handler: restore }),
    auditedRoute({ name: 'projects.members', method: 'get', path: `${BASE}/:projectId/members`, permission: AUTHENTICATED, middlewares: projectParams, handler: members }),
    auditedRoute({ name: 'projects.addMember', method: 'post', path: `${BASE}/:projectId/members`, permission: 'members.invite', middlewares: [...projectParams, validate(projectMemberCreateSchema)], handler: addMember }),
    auditedRoute({ name: 'projects.changeMemberRole', method: 'patch', path: `${BASE}/:projectId/members/:userId`, permission: 'members.invite', middlewares: [...memberRoleParams, validate(projectMemberRoleUpdateSchema)], handler: changeMemberRole }),
    auditedRoute({ name: 'projects.removeMember', method: 'delete', path: `${BASE}/:projectId/members/:userId`, permission: 'members.invite', middlewares: memberRoleParams, handler: removeMember }),
    auditedRoute({ name: 'projects.environments', method: 'get', path: `${BASE}/:projectId/environments`, permission: AUTHENTICATED, middlewares: projectParams, handler: environments }),
    auditedRoute({ name: 'projects.createEnvironment', method: 'post', path: `${BASE}/:projectId/environments`, permission: 'environments.manage', middlewares: [...projectParams, validate(environmentCreateSchema)], handler: createEnvironment }),
    auditedRoute({ name: 'projects.environment', method: 'get', path: `${BASE}/:projectId/environments/:environmentId`, permission: AUTHENTICATED, middlewares: environmentParams, handler: environment }),
    auditedRoute({ name: 'projects.updateEnvironment', method: 'patch', path: `${BASE}/:projectId/environments/:environmentId`, permission: 'environments.manage', middlewares: [...environmentParams, validate(environmentUpdateSchema)], handler: updateEnvironment }),
    auditedRoute({ name: 'projects.removeEnvironment', method: 'delete', path: `${BASE}/:projectId/environments/:environmentId`, permission: 'environments.manage', middlewares: [...environmentParams, validate(typedConfirmationSchema)], handler: removeEnvironment }),
    auditedRoute({ name: 'projects.archiveEnvironment', method: 'post', path: `${BASE}/:projectId/environments/:environmentId/archive`, permission: 'environments.manage', middlewares: environmentParams, handler: archiveEnvironment }),
    auditedRoute({ name: 'projects.restoreEnvironment', method: 'post', path: `${BASE}/:projectId/environments/:environmentId/restore`, permission: 'environments.manage', middlewares: environmentParams, handler: restoreEnvironment }),
    auditedRoute({ name: 'projects.duplicateEnvironment', method: 'post', path: `${BASE}/:projectId/environments/:environmentId/duplicate`, permission: 'environments.manage', middlewares: [...environmentParams, validate(environmentDuplicateSchema)], handler: duplicateEnvironment }),
    auditedRoute({ name: 'projects.diff', method: 'get', path: `${BASE}/:projectId/environments/:fromEnvironmentId/diff/:toEnvironmentId`, permission: 'secrets.read', middlewares: [validate(diffParamSchema, 'params')], handler: diff }),
    auditedRoute({ name: 'projects.resolve', method: 'get', path: `${BASE}/:projectId/environments/:environmentId/resolve`, permission: 'secrets.read', middlewares: environmentParams, handler: resolve }),
  ];
}
