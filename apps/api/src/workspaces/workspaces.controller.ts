import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { RateLimitService } from '../auth/rate-limit.service';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AUTHENTICATED, RequirePermission } from '../authz/require-permission.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService
  ) {}

  @Post()
  @RequirePermission(AUTHENTICATED)
  create(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(workspaceCreateSchema)) body: WorkspaceCreateInput
  ) {
    return this.workspaces.create(req.user.sub, body);
  }

  @Get()
  @RequirePermission(AUTHENTICATED)
  list(@Req() req: AuthenticatedRequest) {
    return this.workspaces.list(req.user.sub);
  }

  @Get('active')
  @RequirePermission(AUTHENTICATED)
  active(@Req() req: AuthenticatedRequest) {
    return this.workspaces.getActive(req.user.sub);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(AUTHENTICATED)
  accept(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(invitationTokenSchema)) body: InvitationTokenInput
  ) {
    this.rateLimit.check(`invite-accept:${req.ip}`, 10, 60_000);
    return this.workspaces.acceptInvitation(req.user.sub, body.token);
  }

  @Post('invitations/decline')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(AUTHENTICATED)
  decline(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(invitationTokenSchema)) body: InvitationTokenInput
  ) {
    this.rateLimit.check(`invite-decline:${req.ip}`, 10, 60_000);
    return this.workspaces.declineInvitation(req.user.sub, body.token);
  }

  @Get(':workspaceId')
  @RequirePermission(AUTHENTICATED)
  get(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string }
  ) {
    return this.workspaces.get(req.user.sub, params.workspaceId);
  }

  @Patch(':workspaceId')
  @RequirePermission('members.invite')
  update(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string },
    @Body(new ZodValidationPipe(workspaceUpdateSchema)) body: WorkspaceUpdateInput
  ) {
    return this.workspaces.update(req.user.sub, params.workspaceId, body);
  }

  @Delete(':workspaceId')
  @RequirePermission('members.invite')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string },
    @Body(new ZodValidationPipe(deleteWorkspaceSchema)) body: DeleteWorkspaceInput
  ) {
    return this.workspaces.remove(req.user.sub, params.workspaceId, body.confirmation);
  }

  @Post(':workspaceId/select')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(AUTHENTICATED)
  select(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string }
  ) {
    return this.workspaces.select(req.user.sub, params.workspaceId);
  }

  @Get(':workspaceId/members')
  @RequirePermission(AUTHENTICATED)
  members(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string }
  ) {
    return this.workspaces.listMembers(req.user.sub, params.workspaceId);
  }

  @Patch(':workspaceId/members/:userId')
  @RequirePermission('members.invite')
  changeRole(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(memberIdParamSchema)) params: { workspaceId: string; userId: string },
    @Body(new ZodValidationPipe(memberRoleUpdateSchema)) body: MemberRoleUpdateInput
  ) {
    return this.workspaces.changeRole(req.user.sub, params.workspaceId, params.userId, body.role);
  }

  @Delete(':workspaceId/members/:userId')
  @RequirePermission('members.invite')
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(memberIdParamSchema)) params: { workspaceId: string; userId: string }
  ) {
    return this.workspaces.removeMember(req.user.sub, params.workspaceId, params.userId);
  }

  @Post(':workspaceId/transfer-owner')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('members.invite')
  transferOwner(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string },
    @Body(new ZodValidationPipe(ownerTransferSchema)) body: OwnerTransferInput
  ) {
    return this.workspaces.transferOwner(req.user.sub, params.workspaceId, body.userId, body.confirmation);
  }

  @Post(':workspaceId/invitations')
  @RequirePermission('members.invite')
  invite(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string },
    @Body(new ZodValidationPipe(invitationCreateSchema)) body: InvitationCreateInput
  ) {
    this.rateLimit.check(`workspace-invite:${req.ip}`, 20, 60_000);
    return this.workspaces.invite(req.user.sub, params.workspaceId, body);
  }

  @Get(':workspaceId/invitations')
  @RequirePermission('members.invite')
  invitations(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string }
  ) {
    return this.workspaces.listInvitations(req.user.sub, params.workspaceId);
  }

  @Post(':workspaceId/invitations/:invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('members.invite')
  revoke(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(invitationIdParamSchema)) params: { workspaceId: string; invitationId: string }
  ) {
    return this.workspaces.revokeInvitation(req.user.sub, params.workspaceId, params.invitationId);
  }
}
