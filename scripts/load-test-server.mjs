import { createRequire } from 'node:module';

process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/aegis';
process.env.AUTH_SECRET ??= 'load-test-secret-value-with-at-least-32-chars';
process.env.ENFORCE_TLS ??= 'false';

const require = createRequire(import.meta.url);
const { createApp } = require('../apps/api/dist/app.js');
const { RateLimitService } = require('../apps/api/dist/auth/rate-limit.service.js');

function stub() {
  return new Proxy(function empty() {}, {
    get(_target, property) {
      if (property === 'then') {
        return undefined;
      }
      return stub();
    },
    apply() {
      return undefined;
    },
  });
}

const deps = {
  audits: stub(),
  tokens: stub(),
  policy: stub(),
  auth: stub(),
  google: stub(),
  rateLimit: new RateLimitService(),
  workspaces: stub(),
  projects: stub(),
  secrets: stub(),
  rotation: stub(),
  serviceTokens: stub(),
  billing: stub(),
  webhooks: stub(),
};

const port = Number(process.env.LOAD_TEST_PORT ?? 3101);
const app = createApp(deps);
app.listen(port, '127.0.0.1', () => {
  process.stdout.write(`load-test-server-ready:${port}\n`);
});
