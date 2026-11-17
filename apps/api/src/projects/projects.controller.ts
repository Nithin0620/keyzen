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
} from '@nestjs/common';
import {
  diffParamSchema,
  environmentCreateSchema,
  environmentDuplicateSchema,
  environmentIdParamSchema,
  environmentUpdateSchema,
  projectCreateSchema,
  projectIdParamSchema,
  projectMemberCreateSchema,
  projectMemberParamSchema,
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
import { AUTHENTICATED, RequirePermission } from '../authz/require-permission.decorator';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProjectsService } from './projects.service';

@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  @RequirePermission(AUTHENTICATED)
  create(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string },
    @Body(new ZodValidationPipe(projectCreateSchema)) body: ProjectCreateInput
  ) {
    return this.projects.create(req.user.sub, params.workspaceId, body);
  }

  @Get()
  @RequirePermission(AUTHENTICATED)
  list(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(workspaceIdParamSchema)) params: { workspaceId: string }
  ) {
    return this.projects.list(req.user.sub, params.workspaceId);
  }

  @Get(':projectId')
  @RequirePermission(AUTHENTICATED)
  get(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string }
  ) {
    return this.projects.get(req.user.sub, params.workspaceId, params.projectId);
  }

  @Patch(':projectId')
  @RequirePermission('environments.manage')
  update(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(projectUpdateSchema)) body: ProjectUpdateInput
  ) {
    return this.projects.update(req.user.sub, params.workspaceId, params.projectId, body);
  }

  @Delete(':projectId')
  @RequirePermission('environments.manage')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(typedConfirmationSchema)) body: TypedConfirmationInput
  ) {
    return this.projects.remove(req.user.sub, params.workspaceId, params.projectId, body.confirmation);
  }

  @Post(':projectId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('environments.manage')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string }
  ) {
    return this.projects.archive(req.user.sub, params.workspaceId, params.projectId);
  }

  @Post(':projectId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('environments.manage')
  restore(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string }
  ) {
    return this.projects.restore(req.user.sub, params.workspaceId, params.projectId);
  }

  @Get(':projectId/members')
  @RequirePermission(AUTHENTICATED)
  members(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string }
  ) {
    return this.projects.listMembers(req.user.sub, params.workspaceId, params.projectId);
  }

  @Post(':projectId/members')
  @RequirePermission('members.invite')
  addMember(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(projectMemberCreateSchema)) body: ProjectMemberCreateInput
  ) {
    return this.projects.addMember(req.user.sub, params.workspaceId, params.projectId, body);
  }

  @Patch(':projectId/members/:userId')
  @RequirePermission('members.invite')
  changeMemberRole(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectMemberParamSchema))
    params: { workspaceId: string; projectId: string; userId: string },
    @Body(new ZodValidationPipe(projectMemberRoleUpdateSchema)) body: ProjectMemberRoleUpdateInput
  ) {
    return this.projects.changeMemberRole(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.userId,
      body
    );
  }

  @Delete(':projectId/members/:userId')
  @RequirePermission('members.invite')
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectMemberParamSchema))
    params: { workspaceId: string; projectId: string; userId: string }
  ) {
    return this.projects.removeMember(req.user.sub, params.workspaceId, params.projectId, params.userId);
  }

  @Get(':projectId/environments')
  @RequirePermission(AUTHENTICATED)
  environments(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string }
  ) {
    return this.projects.listEnvironments(req.user.sub, params.workspaceId, params.projectId);
  }

  @Post(':projectId/environments')
  @RequirePermission('environments.manage')
  createEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(environmentCreateSchema)) body: EnvironmentCreateInput
  ) {
    return this.projects.createEnvironment(req.user.sub, params.workspaceId, params.projectId, body);
  }

  @Get(':projectId/environments/:environmentId')
  @RequirePermission(AUTHENTICATED)
  environment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string }
  ) {
    return this.projects.getEnvironment(req.user.sub, params.workspaceId, params.projectId, params.environmentId);
  }

  @Patch(':projectId/environments/:environmentId')
  @RequirePermission('environments.manage')
  updateEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string },
    @Body(new ZodValidationPipe(environmentUpdateSchema)) body: EnvironmentUpdateInput
  ) {
    return this.projects.updateEnvironment(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.environmentId,
      body
    );
  }

  @Delete(':projectId/environments/:environmentId')
  @RequirePermission('environments.manage')
  removeEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string },
    @Body(new ZodValidationPipe(typedConfirmationSchema)) body: TypedConfirmationInput
  ) {
    return this.projects.removeEnvironment(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.environmentId,
      body.confirmation
    );
  }

  @Post(':projectId/environments/:environmentId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('environments.manage')
  archiveEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string }
  ) {
    return this.projects.archiveEnvironment(req.user.sub, params.workspaceId, params.projectId, params.environmentId);
  }

  @Post(':projectId/environments/:environmentId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('environments.manage')
  restoreEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string }
  ) {
    return this.projects.restoreEnvironment(req.user.sub, params.workspaceId, params.projectId, params.environmentId);
  }

  @Post(':projectId/environments/:environmentId/duplicate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('environments.manage')
  duplicateEnvironment(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string },
    @Body(new ZodValidationPipe(environmentDuplicateSchema)) body: EnvironmentDuplicateInput
  ) {
    return this.projects.duplicateEnvironment(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.environmentId,
      body
    );
  }

  @Get(':projectId/environments/:fromEnvironmentId/diff/:toEnvironmentId')
  @RequirePermission('secrets.read')
  diff(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(diffParamSchema))
    params: {
      workspaceId: string;
      projectId: string;
      fromEnvironmentId: string;
      toEnvironmentId: string;
    }
  ) {
    return this.projects.diffEnvironments(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.fromEnvironmentId,
      params.toEnvironmentId
    );
  }

  @Get(':projectId/environments/:environmentId/resolve')
  @RequirePermission('secrets.read')
  resolve(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentIdParamSchema))
    params: { workspaceId: string; projectId: string; environmentId: string }
  ) {
    return this.projects.resolveEnvironment(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.environmentId
    );
  }
}
