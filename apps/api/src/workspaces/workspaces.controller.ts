import type { RequestHandler } from 'express';
import {
  deleteWorkspaceSchema,
  invitationCreateSchema,
  invitationIdParamSchema,
  invitationTokenSchema,
  memberIdParamSchema,
  memberRoleUpdateSchema,
  ownerTransferSchema,
  workspaceCreateSchema,
  workspaceIdParamSchema,
  workspaceUpdateSchema,
  type DeleteWorkspaceInput,
  type InvitationCreateInput,
  type InvitationTokenInput,
  type MemberRoleUpdateInput,
  type OwnerTransferInput,
  type WorkspaceCreateInput,
  type WorkspaceUpdateInput,
} from '@aegis/shared';
import type { RateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AUTHENTICATED, auditedRoute } from '../authz/route-manifest';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { WorkspacesService } from './workspaces.service';

interface WorkspaceRouteDependencies {
  workspaces: WorkspacesService;
  rateLimit: RateLimitService;
}

export function createWorkspaceRoutes(deps: WorkspaceRouteDependencies): ManagedRoute[] {
  const user = (req: Parameters<RequestHandler>[0]): string => (req as AuthenticatedRequest).user.sub;

  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await deps.workspaces.create(user(req), req.body as WorkspaceCreateInput));
  };

  const list: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.list(user(req)));
  };

  const active: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.getActive(user(req)));
  };

  const accept: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`invite-accept:${req.ip}`, 10, 60_000);
    res.json(await deps.workspaces.acceptInvitation(user(req), (req.body as InvitationTokenInput).token));
  };

  const decline: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`invite-decline:${req.ip}`, 10, 60_000);
    res.json(await deps.workspaces.declineInvitation(user(req), (req.body as InvitationTokenInput).token));
  };

  const get: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.get(user(req), req.params.workspaceId));
  };

  const update: RequestHandler = async (req, res) => {
    res.json(
      await deps.workspaces.update(user(req), req.params.workspaceId, req.body as WorkspaceUpdateInput)
    );
  };

  const remove: RequestHandler = async (req, res) => {
    res.json(
      await deps.workspaces.remove(user(req), req.params.workspaceId, (req.body as DeleteWorkspaceInput).confirmation)
    );
  };

  const select: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.select(user(req), req.params.workspaceId));
  };

  const members: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.listMembers(user(req), req.params.workspaceId));
  };

  const changeRole: RequestHandler = async (req, res) => {
    res.json(
      await deps.workspaces.changeRole(
        user(req),
        req.params.workspaceId,
        req.params.userId,
        (req.body as MemberRoleUpdateInput).role
      )
    );
  };

  const removeMember: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.removeMember(user(req), req.params.workspaceId, req.params.userId));
  };

  const transferOwner: RequestHandler = async (req, res) => {
    const body = req.body as OwnerTransferInput;
    res.json(
      await deps.workspaces.transferOwner(user(req), req.params.workspaceId, body.userId, body.confirmation)
    );
  };

  const invite: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`workspace-invite:${req.ip}`, 20, 60_000);
    res.status(201).json(
      await deps.workspaces.invite(user(req), req.params.workspaceId, req.body as InvitationCreateInput)
    );
  };

  const invitations: RequestHandler = async (req, res) => {
    res.json(await deps.workspaces.listInvitations(user(req), req.params.workspaceId));
  };

  const revoke: RequestHandler = async (req, res) => {
    res.json(
      await deps.workspaces.revokeInvitation(user(req), req.params.workspaceId, req.params.invitationId)
    );
  };

  return [
    auditedRoute({ name: 'workspaces.create', method: 'post', path: '/workspaces', permission: AUTHENTICATED, middlewares: [validate(workspaceCreateSchema)], handler: create }),
    auditedRoute({ name: 'workspaces.list', method: 'get', path: '/workspaces', permission: AUTHENTICATED, handler: list }),
    auditedRoute({ name: 'workspaces.active', method: 'get', path: '/workspaces/active', permission: AUTHENTICATED, handler: active }),
    auditedRoute({ name: 'workspaces.acceptInvitation', method: 'post', path: '/workspaces/invitations/accept', permission: AUTHENTICATED, middlewares: [validate(invitationTokenSchema)], handler: accept }),
    auditedRoute({ name: 'workspaces.declineInvitation', method: 'post', path: '/workspaces/invitations/decline', permission: AUTHENTICATED, middlewares: [validate(invitationTokenSchema)], handler: decline }),
    auditedRoute({ name: 'workspaces.get', method: 'get', path: '/workspaces/:workspaceId', permission: AUTHENTICATED, middlewares: [validate(workspaceIdParamSchema, 'params')], handler: get }),
    auditedRoute({ name: 'workspaces.update', method: 'patch', path: '/workspaces/:workspaceId', permission: 'members.invite', middlewares: [validate(workspaceIdParamSchema, 'params'), validate(workspaceUpdateSchema)], handler: update }),
    auditedRoute({ name: 'workspaces.remove', method: 'delete', path: '/workspaces/:workspaceId', permission: 'members.invite', middlewares: [validate(workspaceIdParamSchema, 'params'), validate(deleteWorkspaceSchema)], handler: remove }),
    auditedRoute({ name: 'workspaces.select', method: 'post', path: '/workspaces/:workspaceId/select', permission: AUTHENTICATED, middlewares: [validate(workspaceIdParamSchema, 'params')], handler: select }),
    auditedRoute({ name: 'workspaces.members', method: 'get', path: '/workspaces/:workspaceId/members', permission: AUTHENTICATED, middlewares: [validate(workspaceIdParamSchema, 'params')], handler: members }),
    auditedRoute({ name: 'workspaces.changeRole', method: 'patch', path: '/workspaces/:workspaceId/members/:userId', permission: 'members.invite', middlewares: [validate(memberIdParamSchema, 'params'), validate(memberRoleUpdateSchema)], handler: changeRole }),
    auditedRoute({ name: 'workspaces.removeMember', method: 'delete', path: '/workspaces/:workspaceId/members/:userId', permission: 'members.invite', middlewares: [validate(memberIdParamSchema, 'params')], handler: removeMember }),
    auditedRoute({ name: 'workspaces.transferOwner', method: 'post', path: '/workspaces/:workspaceId/transfer-owner', permission: 'members.invite', middlewares: [validate(workspaceIdParamSchema, 'params'), validate(ownerTransferSchema)], handler: transferOwner }),
    auditedRoute({ name: 'workspaces.invite', method: 'post', path: '/workspaces/:workspaceId/invitations', permission: 'members.invite', middlewares: [validate(workspaceIdParamSchema, 'params'), validate(invitationCreateSchema)], handler: invite }),
    auditedRoute({ name: 'workspaces.invitations', method: 'get', path: '/workspaces/:workspaceId/invitations', permission: 'members.invite', middlewares: [validate(workspaceIdParamSchema, 'params')], handler: invitations }),
    auditedRoute({ name: 'workspaces.revokeInvitation', method: 'post', path: '/workspaces/:workspaceId/invitations/:invitationId/revoke', permission: 'members.invite', middlewares: [validate(invitationIdParamSchema, 'params')], handler: revoke }),
  ];
}
