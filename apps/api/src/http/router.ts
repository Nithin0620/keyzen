import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { authenticate, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import type { TokenService } from '../auth/token.service';
import type { AuditService } from '../audit/audit.service';
import { auditContextFromRequest, currentAuditContext, withAuditContext } from '../audit/audit-context';
import { ForbiddenException, UnauthorizedException } from '../common/http-error';
import type { PolicyService } from '../authz/policy.service';
import { PUBLIC_ROUTES } from '../authz/public-routes';
import { AUTHENTICATED, routeKey, type RouteDefinition } from '../authz/route-manifest';
import { authenticateServiceToken, type ServiceTokenRequest } from '../credentials/service-token.guard';
import type { ServiceTokenService } from '../credentials/service-token.service';

export interface AuthDependencies {
  tokens: TokenService;
  policy: PolicyService;
  audits: AuditService;
  serviceTokens: ServiceTokenService;
}

export interface ManagedRoute extends RouteDefinition {
  middlewares?: RequestHandler[];
  handler: RequestHandler;
}

function authorize(definition: ManagedRoute, policy: PolicyService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (definition.permission === AUTHENTICATED) {
        next();
        return;
      }
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        throw new UnauthorizedException();
      }
      const allowed = await policy.evaluate(user.sub, definition.permission!, {
        workspaceId: typeof req.params.workspaceId === 'string' ? req.params.workspaceId : undefined,
        projectId: typeof req.params.projectId === 'string' ? req.params.projectId : undefined,
      });
      if (!allowed) {
        throw new ForbiddenException();
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function auditMetadata(definition: ManagedRoute, req: Request): Record<string, unknown> {
  const ids = ['workspaceId', 'projectId', 'secretId', 'environmentId', 'userId'];
  const metadata: Record<string, unknown> = { route: definition.name, method: definition.method };
  for (const key of ids) {
    if (typeof req.params[key] === 'string') {
      metadata[key] = req.params[key];
    }
  }
  return metadata;
}

function auditInput(definition: ManagedRoute, req: Request) {
  const serviceToken = (req as ServiceTokenRequest).serviceToken;
  const metadata = auditMetadata(definition, req);
  if (serviceToken) {
    metadata.environmentId = serviceToken.environmentId;
    metadata.serviceTokenId = serviceToken.id;
  }
  return {
    workspaceId: serviceToken?.workspaceId ?? req.params.workspaceId,
    projectId: serviceToken?.projectId ?? (typeof req.params.projectId === 'string' ? req.params.projectId : null),
    action: definition.name,
    metadata,
  };
}

function auditContextMiddleware(): RequestHandler {
  return (req, _res, next) => {
    const context = auditContextFromRequest(req);
    if (!context) {
      next(new UnauthorizedException());
      return;
    }
    withAuditContext(context, next);
  };
}

function auditMiddleware(definition: ManagedRoute, audits: AuditService): RequestHandler {
  return (req, res, next) => {
    const context = currentAuditContext();
    const input = { ...auditInput(definition, req), actor: context };
    if (definition.audit === 'write') {
      audits
        .record(input)
        .then(() => next())
        .catch(next);
      return;
    }
    const originalJson = res.json.bind(res);
    let recorded = false;
    res.json = ((body: unknown) => {
      if (recorded || res.statusCode >= 400) {
        return originalJson(body);
      }
      recorded = true;
      audits
        .record(input)
        .then(() => originalJson(body))
        .catch(next);
      return res;
    }) as Response['json'];
    next();
  };
}

export function registerRoutes(router: Router, routes: ManagedRoute[], auth: AuthDependencies): void {
  for (const definition of routes) {
    const key = routeKey(definition.method, definition.path);
    if (Boolean(definition.public) !== PUBLIC_ROUTES.has(key)) {
      throw new Error(`Public allowlist mismatch for ${key}`);
    }
    const guards: RequestHandler[] = definition.public
      ? []
      : [definition.auth === 'serviceToken' ? authenticateServiceToken(auth.serviceTokens) : authenticate(auth.tokens)];
    const policy: RequestHandler[] = definition.public ? [] : [authorize(definition, auth.policy)];
    const auditing: RequestHandler[] = definition.audit
      ? [auditContextMiddleware(), auditMiddleware(definition, auth.audits)]
      : [];
    router[definition.method](
      definition.path,
      ...guards,
      ...(definition.middlewares ?? []),
      ...policy,
      ...auditing,
      asyncHandler(definition.handler)
    );
  }
}
