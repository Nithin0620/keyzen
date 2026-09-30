import { hashToken } from '@keyzen/crypto';
import { createDatabaseClient, serviceTokens, environments, projects, orgMembers, eq, and } from '@keyzen/db';
import { FastifyRequest } from 'fastify';

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

  // 1. Check if token is a Keyzen Service Token (kzn_...)
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

    if (!foundToken) {
      return { type: 'ANONYMOUS' };
    }

    if (foundToken.expiresAt && new Date(foundToken.expiresAt) < new Date()) {
      return { type: 'ANONYMOUS' };
    }

    // Update lastUsedAt asynchronously
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

  // 2. Otherwise assume user authentication (e.g. Supabase JWT or User Header)
  // In dev / demo, extract custom user header or pass through user ID
  const userId = (req.headers['x-user-id'] as string) || 'default-user-id';
  const userEmail = (req.headers['x-user-email'] as string) || 'admin@keyzen.dev';

  return {
    type: 'USER',
    userId,
    userEmail,
  };
}
