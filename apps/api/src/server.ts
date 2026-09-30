import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ApolloServer } from '@apollo/server';
import fastifyApollo, { fastifyApolloDrainPlugin } from '@as-integrations/fastify';
import { createDatabaseClient } from '@keyzen/db';
import { config } from './config';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { buildGraphQLContext } from './graphql/context';
import { registerRuntimeRoutes } from './routes/runtime-secrets';

export async function buildApp(dbClient?: ReturnType<typeof createDatabaseClient>): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  const db = dbClient || createDatabaseClient(config.DATABASE_URL);

  // Security headers and CORS
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(','),
    credentials: true,
  });

  await app.register(helmet, {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  await app.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
  });

  // 1. Apollo Server initialization for GraphQL Management API
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [fastifyApolloDrainPlugin(app)],
    introspection: true,
  });

  await apollo.start();

  // Mount GraphQL on /graphql
  await app.register(fastifyApollo(apollo), {
    path: '/graphql',
    context: async (req, reply) => buildGraphQLContext(req, reply, db),
  });

  // 2. Register high-performance REST routes for CLI & SDK
  await registerRuntimeRoutes(app, db);

  return app;
}

// Start server when executed directly
if (process.env.NODE_ENV !== 'test') {
  buildApp()
    .then(async (app) => {
      const address = await app.listen({ port: config.PORT, host: config.HOST });
      console.log(`🚀 Keyzen API & GraphQL Server ready at ${address}`);
      console.log(`🔐 GraphQL endpoint: ${address}/graphql`);
      console.log(`⚡ REST Runtime endpoint: ${address}/api/v1/secrets/resolve`);
    })
    .catch((err) => {
      console.error('Error starting Keyzen server:', err);
      process.exit(1);
    });
}
