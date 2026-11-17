import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { accessTokenFromRequest } from './request-token';
import { TokenService, type AccessTokenPayload } from './token.service';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = accessTokenFromRequest(req);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      req.user = this.tokens.verifyAccess(token);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
