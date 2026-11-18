import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { TokenService } from './auth/token.service';
import { HttpException } from './common/http-error';
import { parseEnv } from './config/env';
import type { RouteDependencies } from './container';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

function createDeps(overrides: Partial<RouteDependencies> = {}): RouteDependencies {
  return {
    audits: { record: vi.fn(async () => undefined) } as any,
    tokens: new TokenService(),
    policy: { evaluate: vi.fn(async () => true) } as any,
    auth: {} as any,
    google: {} as any,
    rateLimit: {} as any,
    workspaces: {} as any,
    projects: {} as any,
    secrets: {} as any,
    rotation: {} as any,
    serviceTokens: {} as any,
    ...overrides,
  } as RouteDependencies;
}

describe('createApp hardening', () => {
  it('sets security headers and request ids', async () => {
    const response = await request(createApp(createDeps())).get('/health/live').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('applies the CORS allowlist', async () => {
    const app = createApp(createDeps());
    await request(app).get('/health/live').set('Origin', 'http://localhost:3000').expect(200);
    await request(app).get('/health/live').set('Origin', 'https://evil.example.com').expect(403);
  });

  it('applies the global per-IP rate limit', async () => {
    const checkWithReset = vi
      .fn<() => { resetAt: number; remaining: number }>()
      .mockImplementationOnce(() => ({ resetAt: Date.now() + 60_000, remaining: 299 }))
      .mockImplementationOnce(() => {
        throw new HttpException('Too many requests', 429);
      });
    const app = createApp(createDeps({ rateLimit: { checkWithReset } as any }));

    const first = await request(app).get('/workspaces').expect(401);
    expect(first.headers['x-ratelimit-limit']).toEqual(expect.any(String));
    expect(first.headers['x-ratelimit-remaining']).toBe('299');
    const second = await request(app).get('/workspaces').expect(429);
    expect(second.headers['retry-after']).toBe('60');
    expect(checkWithReset).toHaveBeenCalledTimes(2);
  });

  it('passes raw webhook bodies to signature verification', async () => {
    const handleWebhook = vi.fn(async (_body: Buffer, _signature?: string) => undefined);
    const app = createApp(createDeps({ billing: { handleWebhook } as any }));
    const body = JSON.stringify({
      id: 'evt_123',
      object: 'event',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', status: 'active', metadata: { note: 'x'.repeat(240) } } },
    });

    const response = await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'test-signature')
      .send(body)
      .expect(200);

    expect(response.body).toEqual({ received: true });
    expect(handleWebhook).toHaveBeenCalledWith(expect.any(Buffer), 'test-signature');
    expect(handleWebhook.mock.calls[0][0]).toEqual(Buffer.from(body));
  });

  it('enforces TLS before CORS preflight handling', async () => {
    const env = parseEnv({ ...process.env, ENFORCE_TLS: 'true' });
    const app = createApp(createDeps(), env);
    await request(app).options('/workspaces').set('Origin', 'http://localhost:3000').expect(403);
  });

  it('applies the global rate limit before CORS rejection', async () => {
    const checkWithReset = vi.fn<() => { resetAt: number; remaining: number }>(() => {
      throw new HttpException('Too many requests', 429);
    });
    const app = createApp(createDeps({ rateLimit: { checkWithReset } as any }));

    await request(app).get('/workspaces').set('Origin', 'https://evil.example.com').expect(429);

    expect(checkWithReset).toHaveBeenCalledTimes(1);
  });

  it('serves generated API documentation', async () => {
    const app = createApp(createDeps());
    const spec = await request(app).get('/openapi.json').expect(200);
    expect(spec.body.openapi).toBe('3.0.3');
    const docs = await request(app).get('/docs').expect(200);
    expect(docs.text).toContain('swagger-ui');
  });
});
