import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';
import type { WebhookService } from './webhook.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const WEBHOOK_ID = '507f1f77bcf86cd799439013';
const ACTOR_ID = '507f1f77bcf86cd799439099';

describe('WebhooksController', () => {
  let app: Express;
  let webhooks: WebhookService;
  let accessToken: string;

  beforeEach(() => {
    webhooks = {
      create: vi.fn(async () => ({
        id: WEBHOOK_ID,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        url: 'https://hooks.example.com/aegis',
        events: ['secret.created'],
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        secret: 'whsec_test_secret',
      })),
      list: vi.fn(async () => []),
      rotateSecret: vi.fn(async () => ({
        id: WEBHOOK_ID,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        url: 'https://hooks.example.com/aegis',
        events: ['secret.created'],
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        secret: 'whsec_rotated_secret',
      })),
      deactivate: vi.fn(async () => ({
        id: WEBHOOK_ID,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        url: 'https://hooks.example.com/aegis',
        events: ['secret.created'],
        isActive: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
      deliveries: vi.fn(async () => []),
    } as unknown as WebhookService;

    const tokens = new TokenService();
    accessToken = tokens.signAccess({ sub: ACTOR_ID, email: 'admin@example.com', emailVerified: true });
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
      webhooks,
    };
    app = createApp(deps);
  });

  const base = `/workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/webhooks`;

  function authed() {
    return (test: any) => test.set('Authorization', `Bearer ${accessToken}`);
  }

  it('creates and lists webhooks', async () => {
    const body = { url: 'https://hooks.example.com/aegis', events: ['secret.created'] };
    const created = await authed()(request(app).post(base)).send(body).expect(201);
    expect(created.body.secret).toBe('whsec_test_secret');
    expect(webhooks.create).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, body);
    await authed()(request(app).get(base)).expect(200);
    expect(webhooks.list).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID);
  });

  it('rotates a webhook signing secret', async () => {
    const response = await authed()(request(app).post(`${base}/${WEBHOOK_ID}/rotate-secret`)).expect(200);
    expect(response.body.secret).toBe('whsec_rotated_secret');
    expect(webhooks.rotateSecret).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, WEBHOOK_ID);
  });

  it('deactivates a webhook', async () => {
    const response = await authed()(request(app).delete(`${base}/${WEBHOOK_ID}`)).expect(200);
    expect(response.body.isActive).toBe(false);
    expect(webhooks.deactivate).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, WEBHOOK_ID);
  });

  it('lists webhook deliveries', async () => {
    await authed()(request(app).get(`${base}/${WEBHOOK_ID}/deliveries`)).expect(200);
    expect(webhooks.deliveries).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, WEBHOOK_ID);
  });

  it('rejects unsupported events', async () => {
    await authed()(request(app).post(base))
      .send({ url: 'https://hooks.example.com/aegis', events: ['billing.changed'] })
      .expect(400);
    expect(webhooks.create).not.toHaveBeenCalled();
  });
});
