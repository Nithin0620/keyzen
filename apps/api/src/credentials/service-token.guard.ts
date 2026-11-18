import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedException } from '../common/http-error';
import { type ServiceTokenIdentity, ServiceTokenService } from './service-token.service';

export interface ServiceTokenRequest extends Request {
  serviceToken?: ServiceTokenIdentity;
}

function serviceTokenFromRequest(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

export function authenticateServiceToken(serviceTokens: ServiceTokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = serviceTokenFromRequest(req);
    if (!token) {
      next(new UnauthorizedException());
      return;
    }
    serviceTokens
      .authenticate(token)
      .then((identity) => {
        (req as ServiceTokenRequest).serviceToken = identity;
        next();
      })
      .catch(() => next(new UnauthorizedException()));
  };
}
