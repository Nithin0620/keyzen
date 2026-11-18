import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';
import type { BillingService } from './billing.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const ACTOR_ID = '507f1f77bcf86cd799439099';

describe('BillingController', () => {
  let app: Express;
  let billing: BillingService;
  let accessToken: string;

  beforeEach(() => {
    billing = {
      get: vi.fn(async () => ({
        workspaceId: WORKSPACE_ID,
        plan: 'FREE',
        status: 'ACTIVE',
        currentPeriodEnd: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      })),
      createCheckout: vi.fn(async () => ({ sessionId: 'cs_test', url: 'https://checkout.stripe.com/c/pay' })),
      handleWebhook: vi.fn(async () => undefined),
    } as unknown as BillingService;

    const tokens = new TokenService();
    accessToken = tokens.signAccess({ sub: ACTOR_ID, email: 'owner@example.com', emailVerified: true });
    const deps: RouteDependencies = {
      audits: { record: vi.fn(async () => undefined) } as any,
      tokens,
      policy: { evaluate: vi.fn(async () => true) } as any,
      auth: {} as any,
      google: {} as any,
      rateLimit: {} as any,
      workspaces: {} as any,
      projects: {} as any,
      secrets: {} as any,
      rotation: {} as any,
      serviceTokens: {} as any,
      billing,
    };
    app = createApp(deps);
  });

  it('exposes billing reads and checkout for authorized workspace users', async () => {
    const base = `/workspaces/${WORKSPACE_ID}/billing`;
    expect((await request(app).get(base).set('Authorization', `Bearer ${accessToken}`).expect(200)).body.plan).toBe(
      'FREE'
    );
    expect(billing.get).toHaveBeenCalledWith(WORKSPACE_ID);

    const response = await request(app)
      .post(`${base}/checkout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan: 'PRO' })
      .expect(201);
    expect(response.body.sessionId).toBe('cs_test');
    expect(billing.createCheckout).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, 'PRO', 'owner@example.com');
  });

  it('exposes no API route that changes billing state', async () => {
    const base = `/workspaces/${WORKSPACE_ID}/billing`;
    await request(app)
      .patch(base)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan: 'ENTERPRISE', status: 'ACTIVE' })
      .expect(404);
    await request(app)
      .post(base)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan: 'ENTERPRISE' })
      .expect(404);
    expect(billing.createCheckout).not.toHaveBeenCalled();
    expect(billing.handleWebhook).not.toHaveBeenCalled();
  });

  it('accepts the Stripe webhook as a public raw-body route', async () => {
    await request(app)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=test')
      .send('{"id":"evt_test"}')
      .expect(200);
    expect(billing.handleWebhook).toHaveBeenCalledTimes(1);
    const [body, signature] = vi.mocked(billing.handleWebhook).mock.calls[0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.toString()).toBe('{"id":"evt_test"}');
    expect(signature).toBe('t=1,v1=test');
  });

  it('rejects an invalid checkout plan', async () => {
    await request(app)
      .post(`/workspaces/${WORKSPACE_ID}/billing/checkout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ plan: 'FREE' })
      .expect(400);
    expect(billing.createCheckout).not.toHaveBeenCalled();
  });
});
