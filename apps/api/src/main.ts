import { createApp } from './app';
import { redactText } from './common/redact';
import { validateEnv } from './config/env';
import { createContainer } from './container';
import { logger } from './logging/logger';
import { captureException, flushObservability, startErrorMonitoring } from './observability/errors';
import { startTracing } from './observability/tracing';

async function bootstrap(): Promise<void> {
  const env = validateEnv();
  startErrorMonitoring(env);
  startTracing(env);
  const container = await createContainer();
  const app = createApp({
    audits: container.audits,
    tokens: container.tokens,
    policy: container.policy,
    auth: container.auth,
    google: container.google,
    rateLimit: container.rateLimit,
    workspaces: container.workspaces,
    projects: container.projects,
    secrets: container.secrets,
    rotation: container.rotation,
    serviceTokens: container.serviceTokens,
    billing: container.billing,
    webhooks: container.webhooks,
    connection: container.connection,
    redis: container.redis,
  });

  const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, 'Aegis API listening');
  });
  container.jobs.start(container.jobDefinitions);

  const shutdown = (): void => {
    container.jobs.stop();
    server.close(() => {
      void container.connection.close();
      if (container.redis) {
        void container.redis.quit();
      }
      void flushObservability();
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap().catch((error: unknown) => {
  captureException(error, { phase: 'bootstrap' });
  logger.error(
    { error: redactText(error instanceof Error ? error.message : 'Unknown error') },
    'bootstrap failed'
  );
  process.exitCode = 1;
});
