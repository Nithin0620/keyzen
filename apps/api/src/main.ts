import { createApp } from './app';
import { validateEnv } from './config/env';
import { createContainer } from './container';

async function bootstrap(): Promise<void> {
  const env = validateEnv();
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
  });

  const server = app.listen(env.API_PORT, () => {
    console.log(`Aegis API listening on port ${env.API_PORT}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      void container.connection.close();
      if (container.redis) {
        void container.redis.quit();
      }
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
