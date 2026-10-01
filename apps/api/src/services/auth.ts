import jwt from 'jsonwebtoken';
import { hashToken } from '@keyzen/crypto';
import {
  createDatabaseClient,
  serviceTokens,
  environments,
  eq,
} from '@keyzen/db';
import { FastifyRequest } from 'fastify';
import { config } from '../config';

export interface AuthContext {
  type: 'USER' | 'SERVICE_TOKEN' | 'ANONYMOUS';
  userId?: string;
  userEmail?: string;
  serviceToken?: {
    id: string;
    name: string;
    projectId: string;
    environmentId: string;
    environmentSlug: string;
  };
}

/**
 * Payload shape of the JWT issued by Workflow's /api/v1/auth/login.
 * Signed with NEXTAUTH_SECRET (= config.WORKFLOW_AUTH_SECRET here).
 */
interface WorkflowJwtPayload {
  id: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

/**
 * Attempt to verify a Bearer token as a Workflow-issued JWT.
 * Returns the payload if valid, null if the token is invalid/expired or
 * the secret is not configured.
 */
function verifyWorkflowJwt(token: string): WorkflowJwtPayload | null {
  const secret = config.WORKFLOW_AUTH_SECRET;
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret) as WorkflowJwtPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function authenticateRequest(
  req: FastifyRequest,
  db: ReturnType<typeof createDatabaseClient>
): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { type: 'ANONYMOUS' };
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return { type: 'ANONYMOUS' };
  }

  // ── 1. Keyzen service token (kzn_…) ──────────────────────────────────────
  if (token.startsWith('kzn_')) {
    const tokenHash = hashToken(token);
    const [foundToken] = await db
      .select({
        id: serviceTokens.id,
        name: serviceTokens.name,
        projectId: serviceTokens.projectId,
        environmentId: serviceTokens.environmentId,
        environmentSlug: environments.slug,
        expiresAt: serviceTokens.expiresAt,
      })
      .from(serviceTokens)
      .innerJoin(environments, eq(serviceTokens.environmentId, environments.id))
      .where(eq(serviceTokens.tokenHash, tokenHash))
      .limit(1);

    if (!foundToken) return { type: 'ANONYMOUS' };

    if (foundToken.expiresAt && new Date(foundToken.expiresAt) < new Date()) {
      return { type: 'ANONYMOUS' };
    }

    // Update lastUsedAt asynchronously (fire-and-forget)
    db.update(serviceTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(serviceTokens.id, foundToken.id))
      .execute()
      .catch(() => {});

    return {
      type: 'SERVICE_TOKEN',
      serviceToken: {
        id: foundToken.id,
        name: foundToken.name,
        projectId: foundToken.projectId,
        environmentId: foundToken.environmentId,
        environmentSlug: foundToken.environmentSlug,
      },
    };
  }

  // ── 2. Workflow-issued JWT (shared NEXTAUTH_SECRET) ───────────────────────
  const workflowUser = verifyWorkflowJwt(token);
  if (workflowUser) {
    return {
      type: 'USER',
      userId: workflowUser.id,
      userEmail: workflowUser.email,
    };
  }

  // ── 3. Dev fallback (only when WORKFLOW_AUTH_SECRET is not set) ───────────
  // This should never be reachable in production.
  if (config.NODE_ENV !== 'production' && !config.WORKFLOW_AUTH_SECRET) {
    const userId =
      (req.headers['x-user-id'] as string) || 'default-user-id';
    const userEmail =
      (req.headers['x-user-email'] as string) || 'admin@keyzen.dev';
    return { type: 'USER', userId, userEmail };
  }

  return { type: 'ANONYMOUS' };
}
