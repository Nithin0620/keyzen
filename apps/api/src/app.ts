import express, { Router, type Express } from 'express';
import { validateEnv } from './config/env';
import { buildRoutes, type RouteDependencies } from './container';
import { errorHandler } from './http/error-handler';
import { registerRoutes } from './http/router';
import { requestLogger } from './logging/logger';

export function createApp(deps: RouteDependencies): Express {
  const env = validateEnv();
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', env.WEB_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  const router = Router();
  registerRoutes(router, buildRoutes(deps), {
    tokens: deps.tokens,
    policy: deps.policy,
    audits: deps.audits,
    serviceTokens: deps.serviceTokens,
  });
  app.use(router);
  app.use(errorHandler);

  return app;
}
