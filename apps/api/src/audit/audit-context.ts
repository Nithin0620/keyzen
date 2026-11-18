import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import type { ServiceTokenRequest } from '../credentials/service-token.guard';
import { hashIp } from '../common/tokens';

export type AuditActorType = 'USER' | 'SERVICE_TOKEN' | 'SYSTEM';

export interface AuditContextInput {
  actorType: AuditActorType;
  actorId: string;
  ipHash?: string;
  userAgent?: string;
}

export type AuditContext = AuditContextInput;

const storage = new AsyncLocalStorage<AuditContext>();

export function withAuditContext<T>(context: AuditContext, work: () => T): T {
  return storage.run(context, work);
}

export function currentAuditContext(): AuditContext | undefined {
  return storage.getStore();
}

export function auditContextFromRequest(req: Request): AuditContext | undefined {
  const serviceToken = (req as ServiceTokenRequest).serviceToken;
  if (serviceToken) {
    return {
      actorType: 'SERVICE_TOKEN',
      actorId: serviceToken.id,
      ipHash: hashIp(req.ip ?? ''),
      userAgent: req.get('user-agent')?.slice(0, 500),
    };
  }
  const user = (req as AuthenticatedRequest).user;
  if (!user?.sub) {
    return undefined;
  }
  return {
    actorType: 'USER',
    actorId: user.sub,
    ipHash: hashIp(req.ip ?? ''),
    userAgent: req.get('user-agent')?.slice(0, 500),
  };
}
