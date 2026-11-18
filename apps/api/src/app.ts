import express, { Router, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { validateEnv, type Env } from './config/env';
import { globalValidation } from './common/global-validation';
import { buildRoutes, type RouteDependencies } from './container';
import { createCors } from './http/cors';
import { errorHandler } from './http/error-handler';
import { registerRoutes } from './http/router';
import { enforceTls, limitUrl, requestId } from './http/security';
import { requestLogger } from './logging/logger';
import { traceRoute } from './observability/tracing';

function globalRateLimit(
  check: RouteDependencies['rateLimit']['checkWithReset'],
  limit: number,
  windowMs: number
): RequestHandler {
  return (req, res, next) => {
    if (
      req.path === '/health' ||
      req.path.startsWith('/health/') ||
      req.path.startsWith('/docs') ||
      req.path === '/openapi.json'
    ) {
      next();
      return;
    }
    try {
      const { resetAt, remaining } = check(`ip:${req.ip ?? 'unknown'}`, limit, windowMs);
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      next();
    } catch (error) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      next(error);
    }
  };
}

export function createApp(deps: RouteDependencies, env: Env = validateEnv()): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: env.ENFORCE_TLS ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );
  app.use(requestId());
  app.use(limitUrl(env.MAX_URL_LENGTH));
  app.use(enforceTls(env.ENFORCE_TLS));
  if (deps.rateLimit?.checkWithReset) {
    app.use(
      globalRateLimit(
        deps.rateLimit.checkWithReset.bind(deps.rateLimit),
        env.GLOBAL_RATE_LIMIT,
        env.GLOBAL_RATE_WINDOW_MS
      )
    );
  }
  app.use(
    createCors([
      env.WEB_ORIGIN,
      ...(env.WEB_ORIGINS
        ? env.WEB_ORIGINS.split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : []),
    ])
  );

  app.use('/billing/webhook', express.raw({ type: 'application/json', limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));
  app.use(globalValidation());
  app.use(requestLogger);

  const router = Router();
  registerRoutes(router, buildRoutes(deps), {
    tokens: deps.tokens,
    policy: deps.policy,
    audits: deps.audits,
    serviceTokens: deps.serviceTokens,
  }, traceRoute);
  app.use(router);
  app.use(errorHandler);

  return app;
}
