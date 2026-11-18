import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';
import type { KeyRotationService } from './key-rotation.service';
import type { SecretsService } from './secrets.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const SECRET_ID = '507f1f77bcf86cd799439013';
const ENVIRONMENT_ID = '507f1f77bcf86cd799439014';
const ACTOR_ID = '507f1f77bcf86cd799439099';

describe('SecretsController', () => {
  let app: Express;
  let secrets: SecretsService;
  let rotation: KeyRotationService;
  let accessToken: string;

  beforeEach(() => {
    secrets = {
      create: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY', value: { present: true, masked: '••••••' } })),
      list: vi.fn(async () => []),
      get: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY' })),
      reveal: vi.fn(async () => ({ name: 'API_KEY', value: 'plaintext' })),
      history: vi.fn(async () => [{ version: 1, changedBy: ACTOR_ID, createdAt: '2026-01-01T00:00:00.000Z' }]),
      rollback: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY', version: 3 })),
      update: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY' })),
      upsertValue: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY' })),
      remove: vi.fn(async () => undefined),
      import: vi.fn(async () => ({ imported: 1 })),
      export: vi.fn(async () => ({ entries: [{ name: 'API_KEY', value: 'plaintext' }] })),
    } as unknown as SecretsService;
    rotation = {
      rotateProjectKeys: vi.fn(async () => ({ rotated: 1 })),
    } as unknown as KeyRotationService;

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
      secrets,
      rotation,
      serviceTokens: {} as any,
    };
    app = createApp(deps);
  });

  const base = `/workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/secrets`;
  const secret = `${base}/${SECRET_ID}`;

  function authed() {
    const appRequest = request(app);
    const withAuth = (test: any) => test.set('Authorization', `Bearer ${accessToken}`);
    return {
      get: (url: string) => withAuth(appRequest.get(url)),
      post: (url: string) => withAuth(appRequest.post(url)),
      patch: (url: string) => withAuth(appRequest.patch(url)),
      put: (url: string) => withAuth(appRequest.put(url)),
      delete: (url: string) => withAuth(appRequest.delete(url)),
    };
  }

  it('exposes secret create, list, get, reveal, update, value upsert and typed delete', async () => {
    const body = { environmentId: ENVIRONMENT_ID, name: 'API_KEY', value: 'plaintext' };
    expect((await authed().post(base).send(body).expect(201)).body.id).toBe(SECRET_ID);
    expect(secrets.create).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, body);
    await authed().get(base).query({ environmentId: ENVIRONMENT_ID }).expect(200);
    await authed().get(secret).query({ environmentId: ENVIRONMENT_ID }).expect(200);
    expect(
      (await authed().get(`${secret}/reveal`).query({ environmentId: ENVIRONMENT_ID }).expect(200)).body.value
    ).toBe('plaintext');
    await authed().patch(secret).send({ description: 'primary' }).expect(200);
    await authed()
      .put(`${secret}/environments/${ENVIRONMENT_ID}/value`)
      .send({ value: 'new-value' })
      .expect(200);
    await authed().delete(secret).send({ confirmation: 'API_KEY' }).expect(200);
    expect(secrets.remove).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, SECRET_ID, 'API_KEY');
  });

  it('exposes import, export and key rotation routes', async () => {
    expect(
      (await authed()
        .post(`${base}/import`)
        .send({ environmentId: ENVIRONMENT_ID, contents: 'API_KEY=value' })
        .expect(201)).body.imported
    ).toBe(1);
    expect(
      (await authed().get(`${base}/export`).query({ environmentId: ENVIRONMENT_ID }).expect(200))
        .body.entries[0].name
    ).toBe('API_KEY');
    expect(
      (await authed()
        .post(`${base}/keys/rotate`)
        .send({ targetKeyId: 'env-master-v2' })
        .expect(201)).body.rotated
    ).toBe(1);
    expect(rotation.rotateProjectKeys).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, 'env-master-v2');
  });

  it('exposes secret history and confirmation-gated rollback', async () => {
    const historyResponse = await authed()
      .get(`${secret}/history`)
      .query({ environmentId: ENVIRONMENT_ID })
      .expect(200);
    expect(historyResponse.body[0].version).toBe(1);
    expect(secrets.history).toHaveBeenCalledWith(
      ACTOR_ID,
      WORKSPACE_ID,
      PROJECT_ID,
      SECRET_ID,
      ENVIRONMENT_ID,
      50
    );

    const rollbackResponse = await authed()
      .post(`${secret}/environments/${ENVIRONMENT_ID}/rollback`)
      .send({ version: 1, confirmation: 'ROLLBACK' })
      .expect(200);
    expect(rollbackResponse.body.version).toBe(3);
    expect(secrets.rollback).toHaveBeenCalledWith(
      ACTOR_ID,
      WORKSPACE_ID,
      PROJECT_ID,
      SECRET_ID,
      ENVIRONMENT_ID,
      1,
      'ROLLBACK'
    );
    await authed()
      .post(`${secret}/environments/${ENVIRONMENT_ID}/rollback`)
      .send({ version: 1, confirmation: 'NO' })
      .expect(400);
  });

  it('rejects invalid ids and malformed secret bodies', async () => {
    await authed().get(`${base}/not-an-id`).expect(400);
    await authed().post(base).send({ name: 'bad name', value: 'x' }).expect(400);
    await authed().post(`${base}/import`).send({ contents: 'API_KEY=value' }).expect(400);
  });
});
