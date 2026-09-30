import { FastifyRequest, FastifyReply } from 'fastify';
import { createDatabaseClient } from '@keyzen/db';
import { authenticateRequest, AuthContext } from '../services/auth';

export interface GraphQLContext {
  db: ReturnType<typeof createDatabaseClient>;
  auth: AuthContext;
  req: FastifyRequest;
  reply: FastifyReply;
}

export async function buildGraphQLContext(
  req: FastifyRequest,
  reply: FastifyReply,
  db: ReturnType<typeof createDatabaseClient>
): Promise<GraphQLContext> {
  const auth = await authenticateRequest(req, db);
  return {
    db,
    auth,
    req,
    reply,
  };
}
