import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedException } from '../common/http-error';
import { accessTokenFromRequest } from './request-token';
import type { TokenService, AccessTokenPayload } from './token.service';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

export function authenticate(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const token = accessTokenFromRequest(req);
      if (!token) {
        throw new UnauthorizedException();
      }
      (req as AuthenticatedRequest).user = tokens.verifyAccess(token);
      next();
    } catch {
      next(new UnauthorizedException());
    }
  };
}
