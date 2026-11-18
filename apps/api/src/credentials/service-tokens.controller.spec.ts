import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';
import type { ServiceTokenService } from './service-token.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const ENVIRONMENT_ID = '507f1f77bcf86cd799439014';
const TOKEN_ID = '507f1f77bcf86cd799439015';
const USER_ID = '507f1f77bcf86cd799439099';

describe('ServiceTokenController', () => {
  let app: Express;
  let serviceTokens: ServiceTokenService;
  let accessToken: string;
  let audits: { record: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    serviceTokens = {
      create: vi.fn(async () => ({
        id: TOKEN_ID,
        name: 'deploy',
        tokenPrefix: 'ags_abcd1234',
        environmentId: ENVIRONMENT_ID,
        status: 'ACTIVE',
        expiresAt: '2026-12-18T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
        token: 'ags_abcd1234secret',
      })),
      list: vi.fn(async () => [
        {
          id: TOKEN_ID,
          name: 'deploy',
          tokenPrefix: 'ags_abcd1234',
          environmentId: ENVIRONMENT_ID,
          status: 'ACTIVE',
          expiresAt: '2026-12-18T00:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null,
        },
      ]),
      rotate: vi.fn(async () => ({ id: TOKEN_ID, token: 'ags_newtoken' })),
      revoke: vi.fn(async () => ({ id: TOKEN_ID, status: 'REVOKED' })),
    } as unknown as ServiceTokenService;
    audits = { record: vi.fn(async () => undefined) };
    const tokens = new TokenService();
    accessToken = tokens.signAccess({ sub: USER_ID, email: 'owner@example.com', emailVerified: true });
    const deps: RouteDependencies = {
      audits: audits as any,
      tokens,
      policy: { evaluate: vi.fn(async () => true) } as any,
      auth: {} as any,
      google: {} as any,
      rateLimit: {} as any,
      workspaces: {} as any,
      projects: {} as any,
      secrets: {} as any,
      rotation: {} as any,
      serviceTokens,
    };
    app = createApp(deps);
  });

  const base = `/workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/credentials`;

  function authed() {
    const appRequest = request(app);
    const withAuth = (test: any) => test.set('Authorization', `Bearer ${accessToken}`);
    return {
      get: (url: string) => withAuth(appRequest.get(url)),
      post: (url: string) => withAuth(appRequest.post(url)),
    };
  }

  it('exposes create, list, rotate and revoke under credentials.manage', async () => {
    const created = await authed()
      .post(base)
      .send({ name: 'deploy', environmentId: ENVIRONMENT_ID, expiresInDays: 30 })
      .expect(201);
    expect(created.body.token).toBe('ags_abcd1234secret');
    expect(serviceTokens.create).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, PROJECT_ID, {
      name: 'deploy',
      environmentId: ENVIRONMENT_ID,
      expiresInDays: 30,
    });

    const listed = await authed().get(base).expect(200);
    expect(listed.body[0].tokenPrefix).toBe('ags_abcd1234');
    expect(JSON.stringify(listed.body)).not.toContain('tokenHash');

    expect(
      (await authed().post(`${base}/${TOKEN_ID}/rotate`).send({ expiresInDays: 14 }).expect(200)).body.token
    ).toBe('ags_newtoken');
    expect(serviceTokens.rotate).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, PROJECT_ID, TOKEN_ID, 14);

    await authed().post(`${base}/${TOKEN_ID}/revoke`).send().expect(200);
    expect(serviceTokens.revoke).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, PROJECT_ID, TOKEN_ID);
    expect(audits.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'credentials.create', actor: expect.objectContaining({ actorType: 'USER' }) })
    );
  });

  it('rejects malformed token ids and service token bodies', async () => {
    await authed()
      .post(base)
      .send({ name: 'deploy', environmentId: 'bad', expiresInDays: 30 })
      .expect(400);
    await authed().post(`${base}/not-an-id/rotate`).send({ expiresInDays: 14 }).expect(400);
    await authed().post(`${base}/${TOKEN_ID}/rotate`).send({ expiresInDays: 500 }).expect(400);
  });
});
