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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  envExportQuerySchema,
  envImportSchema,
  keyRotationSchema,
  secretCreateSchema,
  secretGetQuerySchema,
  secretListQuerySchema,
  secretParamSchema,
  secretRevealQuerySchema,
  secretUpdateSchema,
  secretValueUpsertSchema,
  typedConfirmationSchema,
  projectIdParamSchema,
  environmentSecretParamSchema,
  type EnvExportQuery,
  type EnvImportInput,
  type KeyRotationInput,
  type SecretCreateInput,
  type SecretGetQuery,
  type SecretListQuery,
  type SecretUpdateInput,
  type SecretValueUpsertInput,
  type TypedConfirmationInput,
} from '@aegis/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { KeyRotationService } from './key-rotation.service';
import { SecretsService } from './secrets.service';

@Controller('workspaces/:workspaceId/projects/:projectId/secrets')
export class SecretsController {
  constructor(
    @Inject(SecretsService) private readonly secrets: SecretsService,
    @Inject(KeyRotationService) private readonly rotation: KeyRotationService
  ) {}

  @Post()
  @RequirePermission('secrets.create')
  create(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(secretCreateSchema)) body: SecretCreateInput
  ) {
    return this.secrets.create(req.user.sub, params.workspaceId, params.projectId, body);
  }

  @Get()
  @RequirePermission('secrets.read')
  list(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Query(new ZodValidationPipe(secretListQuerySchema)) query: SecretListQuery
  ) {
    return this.secrets.list(req.user.sub, params.workspaceId, params.projectId, query);
  }

  @Post('import')
  @RequirePermission('secrets.create')
  import(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(envImportSchema)) body: EnvImportInput
  ) {
    return this.secrets.import(req.user.sub, params.workspaceId, params.projectId, body);
  }

  @Get('export')
  @RequirePermission('secrets.export')
  export(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Query(new ZodValidationPipe(envExportQuerySchema)) query: EnvExportQuery
  ) {
    return this.secrets.export(req.user.sub, params.workspaceId, params.projectId, query.environmentId);
  }

  @Post('keys/rotate')
  @RequirePermission('secrets.update')
  rotateKeys(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: { workspaceId: string; projectId: string },
    @Body(new ZodValidationPipe(keyRotationSchema)) body: KeyRotationInput
  ) {
    return this.rotation.rotateProjectKeys(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      body.targetKeyId
    );
  }

  @Get(':secretId')
  @RequirePermission('secrets.read')
  get(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(secretParamSchema)) params: {
      workspaceId: string;
      projectId: string;
      secretId: string;
    },
    @Query(new ZodValidationPipe(secretGetQuerySchema)) query: SecretGetQuery
  ) {
    return this.secrets.get(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.secretId,
      query.environmentId
    );
  }

  @Get(':secretId/reveal')
  @RequirePermission('secrets.read')
  reveal(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(secretParamSchema)) params: {
      workspaceId: string;
      projectId: string;
      secretId: string;
    },
    @Query(new ZodValidationPipe(secretRevealQuerySchema)) query: { environmentId: string }
  ) {
    return this.secrets.reveal(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.secretId,
      query.environmentId
    );
  }

  @Patch(':secretId')
  @RequirePermission('secrets.update')
  update(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(secretParamSchema)) params: {
      workspaceId: string;
      projectId: string;
      secretId: string;
    },
    @Body(new ZodValidationPipe(secretUpdateSchema)) body: SecretUpdateInput
  ) {
    return this.secrets.update(req.user.sub, params.workspaceId, params.projectId, params.secretId, body);
  }

  @Put(':secretId/environments/:environmentId/value')
  @RequirePermission('secrets.update')
  upsertValue(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(environmentSecretParamSchema)) params: {
      workspaceId: string;
      projectId: string;
      environmentId: string;
      secretId: string;
    },
    @Body(new ZodValidationPipe(secretValueUpsertSchema)) body: SecretValueUpsertInput
  ) {
    return this.secrets.upsertValue(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.secretId,
      params.environmentId,
      body
    );
  }

  @Delete(':secretId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('secrets.delete')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(secretParamSchema)) params: {
      workspaceId: string;
      projectId: string;
      secretId: string;
    },
    @Body(new ZodValidationPipe(typedConfirmationSchema)) body: TypedConfirmationInput
  ) {
    return this.secrets.remove(
      req.user.sub,
      params.workspaceId,
      params.projectId,
      params.secretId,
      body.confirmation
    );
  }
}
