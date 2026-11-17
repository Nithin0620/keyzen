import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { accessTokenFromRequest } from '../auth/request-token';
import { TokenService } from '../auth/token.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PUBLIC_ROUTES } from './public-routes';
import { PolicyService } from './policy.service';
import { AUTHENTICATED, PERMISSION_METADATA, type PermissionRequirement } from './require-permission.decorator';
import { routeKey } from './route-key';

function param(params: Record<string, string | string[]>, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PolicyService) private readonly policy: PolicyService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (PUBLIC_ROUTES.has(routeKey(this.reflector, context))) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      const token = accessTokenFromRequest(req);
      if (!token) {
        throw new UnauthorizedException();
      }
      try {
        req.user = this.tokens.verifyAccess(token);
      } catch {
        throw new UnauthorizedException();
      }
    }

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) {
      throw new ForbiddenException('Route is missing permission metadata');
    }
    if (requirement === AUTHENTICATED) {
      return true;
    }

    const allowed = await this.policy.evaluate(req.user.sub, requirement, {
      workspaceId: param(req.params, 'workspaceId'),
      projectId: param(req.params, 'projectId'),
    });
    if (!allowed) {
      throw new ForbiddenException();
    }
    return true;
  }
}
