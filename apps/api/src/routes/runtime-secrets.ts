import { FastifyInstance } from 'fastify';
import { createDatabaseClient, secrets, secretValues, auditLogs, eq, and } from '@keyzen/db';
import { authenticateRequest } from '../services/auth';
import { cryptoService } from '../services/crypto-service';

export async function registerRuntimeRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof createDatabaseClient>
) {
  // Health check endpoint
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'keyzen-api',
      timestamp: new Date().toISOString(),
    };
  });

  // Batch resolve all decrypted secrets for CLI `keyzen run` or SDK `Keyzen.getAll()`
  app.post('/api/v1/secrets/resolve', async (request, reply) => {
    const auth = await authenticateRequest(request, db);

    if (auth.type !== 'SERVICE_TOKEN' || !auth.serviceToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'A valid Keyzen service token (kzn_...) is required to resolve secrets.',
      });
    }

    const { projectId, environmentId, environmentSlug, name: tokenName } = auth.serviceToken;

    // Query all secrets and their corresponding encrypted values for this environment
    const rows = await db
      .select({
        name: secrets.name,
        ciphertext: secretValues.ciphertext,
        iv: secretValues.iv,
        authTag: secretValues.authTag,
        version: secretValues.version,
      })
      .from(secrets)
      .innerJoin(
        secretValues,
        and(
          eq(secretValues.secretId, secrets.id),
          eq(secretValues.environmentId, environmentId)
        )
      )
      .where(eq(secrets.projectId, projectId));

    // Decrypt all secrets in-memory
    const resolvedSecrets: Record<string, string> = {};
    for (const row of rows) {
      try {
        const decrypted = await cryptoService.decryptForProject(projectId, {
          ciphertext: row.ciphertext,
          iv: row.iv,
          authTag: row.authTag,
        });
        resolvedSecrets[row.name] = decrypted;
      } catch (err) {
        request.log.error({ err, secretName: row.name }, 'Failed to decrypt secret value');
      }
    }

    // Log audit event asynchronously
    db.insert(auditLogs)
      .values({
        orgId: (await getOrgIdByProjectId(db, projectId)) || projectId,
        projectId,
        actorType: 'SERVICE_TOKEN',
        actorId: auth.serviceToken.id,
        actorName: tokenName,
        action: 'SECRET_RESOLVE_BATCH',
        metadata: {
          environment: environmentSlug,
          secretCount: Object.keys(resolvedSecrets).length,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })
      .execute()
      .catch(() => {});

    return {
      environment: environmentSlug,
      count: Object.keys(resolvedSecrets).length,
      secrets: resolvedSecrets,
    };
  });

  // Single secret resolve endpoint
  app.get('/api/v1/secrets/:name', async (request, reply) => {
    const auth = await authenticateRequest(request, db);
    const { name } = request.params as { name: string };

    if (auth.type !== 'SERVICE_TOKEN' || !auth.serviceToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'A valid Keyzen service token is required.',
      });
    }

    const { projectId, environmentId } = auth.serviceToken;

    const [row] = await db
      .select({
        name: secrets.name,
        ciphertext: secretValues.ciphertext,
        iv: secretValues.iv,
        authTag: secretValues.authTag,
      })
      .from(secrets)
      .innerJoin(
        secretValues,
        and(
          eq(secretValues.secretId, secrets.id),
          eq(secretValues.environmentId, environmentId)
        )
      )
      .where(and(eq(secrets.projectId, projectId), eq(secrets.name, name)))
      .limit(1);

    if (!row) {
      return reply.status(404).send({
        error: 'NotFound',
        message: `Secret "${name}" not found in this environment.`,
      });
    }

    const value = await cryptoService.decryptForProject(projectId, {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
    });

    return {
      name: row.name,
      value,
    };
  });
}

async function getOrgIdByProjectId(
  db: ReturnType<typeof createDatabaseClient>,
  projectId: string
): Promise<string | null> {
  const { projects } = await import('@keyzen/db');
  const [proj] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return proj?.orgId || null;
}
