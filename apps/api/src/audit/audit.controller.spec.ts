import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const ACTOR_ID = '507f1f77bcf86cd799439099';

describe('audit routes and middleware', () => {
  let app: Express;
  let accessToken: string;
  let audits: { record: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let secrets: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    audits = {
      record: vi.fn(async () => undefined),
      list: vi.fn(async () => [
        {
          id: 'audit-1',
          workspaceId: WORKSPACE_ID,
          projectId: null,
          actorType: 'USER',
          actorId: ACTOR_ID,
          action: 'audit.list',
          metadata: {},
          ipHash: 'hash',
          userAgent: 'test',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    };
    secrets = { create: vi.fn(async () => ({ id: 'secret-1', name: 'API_KEY' })) };
    const tokens = new TokenService();
    accessToken = tokens.signAccess({ sub: ACTOR_ID, email: 'owner@example.com', emailVerified: true });
    const deps: RouteDependencies = {
      audits: audits as any,
      tokens,
      policy: { evaluate: vi.fn(async () => true) } as any,
      auth: {} as any,
      google: {} as any,
      rateLimit: {} as any,
      workspaces: {} as any,
      projects: {} as any,
      secrets: secrets as any,
      rotation: {} as any,
      serviceTokens: {} as any,
    };
    app = createApp(deps);
  });

  function authed() {
    const appRequest = request(app);
    return {
      get: (url: string) => appRequest.get(url).set('Authorization', `Bearer ${accessToken}`),
      post: (url: string) => appRequest.post(url).set('Authorization', `Bearer ${accessToken}`),
    };
  }

  it('exposes tenant-scoped audit log reads with actor attribution', async () => {
    const response = await authed().get(`/workspaces/${WORKSPACE_ID}/audit`).query({ limit: 10 }).expect(200);
    expect(response.body[0].action).toBe('audit.list');
    expect(audits.list).toHaveBeenCalledWith(WORKSPACE_ID, { projectId: undefined, limit: 10 });
    expect(audits.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        action: 'audit.list',
        actor: expect.objectContaining({ actorType: 'USER', actorId: ACTOR_ID }),
      })
    );
  });

  it('blocks a mutation when the awaited audit write fails', async () => {
    audits.record.mockRejectedValueOnce(new Error('audit unavailable'));
    await authed()
      .post(`/workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/secrets`)
      .send({ environmentId: '507f1f77bcf86cd799439014', name: 'API_KEY', value: 'plaintext' })
      .expect(500);
    expect(secrets.create).not.toHaveBeenCalled();
  });

  it('blocks a read response when the awaited audit write fails', async () => {
    audits.record.mockRejectedValueOnce(new Error('audit unavailable'));
    await authed().get(`/workspaces/${WORKSPACE_ID}/audit`).expect(500);
  });
});
