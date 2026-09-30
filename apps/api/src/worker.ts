import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createYoga, createSchema } from 'graphql-yoga';
import { createDatabaseClient, secrets, secretValues, serviceTokens, environments, auditLogs, eq, and } from '@keyzen/db';
import { hashToken } from '@keyzen/crypto';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { cryptoService } from './services/crypto-service';

export interface Env {
  DATABASE_URL: string;
  KEYZEN_MASTER_KEY: string;
  NODE_ENV?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Enable global CORS
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email'],
  })
);

// 1. Health check
app.get('/api/v1/health', (c) => {
  return c.json({
    status: 'ok',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// 2. High-speed REST secret resolve endpoint (Edge)
app.post('/api/v1/secrets/resolve', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Bearer token required' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const db = createDatabaseClient(c.env.DATABASE_URL);

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

  if (!foundToken || (foundToken.expiresAt && new Date(foundToken.expiresAt) < new Date())) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
  }

  // Fetch secrets
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
        eq(secretValues.environmentId, foundToken.environmentId)
      )
    )
    .where(eq(secrets.projectId, foundToken.projectId));

  const resolvedSecrets: Record<string, string> = {};
  for (const row of rows) {
    try {
      const decrypted = await cryptoService.decryptForProject(foundToken.projectId, {
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.authTag,
      });
      resolvedSecrets[row.name] = decrypted;
    } catch {
      // Ignore decryption failure for invalid key version
    }
  }

  return c.json({
    environment: foundToken.environmentSlug,
    count: Object.keys(resolvedSecrets).length,
    secrets: resolvedSecrets,
  });
});

// 3. GraphQL Yoga Management Endpoint (/graphql)
const yoga = createYoga<{
  req: Request;
  env: Env;
}>({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: '/graphql',
  fetchAPI: { Response, Request },
  context: async ({ req, env }) => {
    const db = createDatabaseClient(env.DATABASE_URL);
    const authHeader = req.headers.get('authorization');
    return {
      db,
      auth: {
        type: 'USER',
        userId: req.headers.get('x-user-id') || 'cf-worker-user',
        userEmail: req.headers.get('x-user-email') || 'admin@keyzen.dev',
      },
      req: {
        ip: req.headers.get('cf-connecting-ip') || '127.0.0.1',
        headers: Object.fromEntries(req.headers.entries()),
      },
    };
  },
});

app.all('/graphql', async (c) => {
  const response = await yoga.fetch(c.req.raw, { req: c.req.raw, env: c.env });
  return response;
});

export default app;
