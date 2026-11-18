import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import { HttpException, HttpStatus, UnauthorizedException } from '../common/http-error';
import type { RouteDependencies } from '../container';
import type { SecretsService } from '../secrets/secrets.service';
import type { ServiceTokenService } from '../credentials/service-token.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const ENVIRONMENT_A = '507f1f77bcf86cd799439014';
const ENVIRONMENT_B = '507f1f77bcf86cd799439015';
const TOKEN_ID = '507f1f77bcf86cd799439016';

describe('RuntimeController', () => {
  let app: Express;
  let serviceTokens: ServiceTokenService;
  let secrets: SecretsService;
  let rateLimit: { check: ReturnType<typeof vi.fn> };
  let audits: { record: ReturnType<typeof vi.fn> };
  let policy: { evaluate: ReturnType<typeof vi.fn> };

  const identity = {
    id: TOKEN_ID,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_A,
    expiresAt: '2026-12-18T00:00:00.000Z',
  };

  beforeEach(() => {
    serviceTokens = { authenticate: vi.fn(async () => identity) } as unknown as ServiceTokenService;
    secrets = {
      resolve: vi.fn(async () => ({ entries: [{ name: 'API_KEY', value: 'env-a-value' }] })),
      validate: vi.fn(async () => undefined),
    } as unknown as SecretsService;
    rateLimit = { check: vi.fn() };
    audits = { record: vi.fn(async () => undefined) };
    policy = { evaluate: vi.fn(async () => true) };
    const deps: RouteDependencies = {
      audits: audits as any,
      tokens: new TokenService(),
      policy: policy as any,
      auth: {} as any,
      google: {} as any,
      rateLimit: rateLimit as any,
      workspaces: {} as any,
      projects: {} as any,
      secrets,
      rotation: {} as any,
      serviceTokens,
    };
    app = createApp(deps);
  });

  function tokenRequest() {
    return (test: any) => test.set('Authorization', 'Bearer ags_test-token');
  }

  it('resolves only the token environment and audits with a service-token actor', async () => {
    const response = await tokenRequest()(
      request(app).post('/v1/secrets/resolve').send({ names: ['API_KEY'], environmentId: ENVIRONMENT_B })
    ).expect(200);

    expect(response.body.entries).toEqual([{ name: 'API_KEY', value: 'env-a-value' }]);
    expect(secrets.resolve).toHaveBeenCalledWith(WORKSPACE_ID, PROJECT_ID, ENVIRONMENT_A, ['API_KEY']);
    expect(policy.evaluate).not.toHaveBeenCalled();
    expect(audits.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        action: 'runtime.resolve',
        actor: expect.objectContaining({ actorType: 'SERVICE_TOKEN', actorId: TOKEN_ID }),
        metadata: expect.objectContaining({ environmentId: ENVIRONMENT_A, serviceTokenId: TOKEN_ID }),
      })
    );
    expect(JSON.stringify(audits.record.mock.calls)).not.toContain('ags_test-token');
  });

  it('validates tokens without returning secret values or token hashes', async () => {
    const response = await tokenRequest()(request(app).get('/v1/validate')).expect(200);
    expect(response.body).toEqual({
      valid: true,
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_A,
      expiresAt: identity.expiresAt,
    });
    expect(secrets.validate).toHaveBeenCalledWith(WORKSPACE_ID, PROJECT_ID, ENVIRONMENT_A);
  });

  it('rejects revoked tokens before reaching the secrets service', async () => {
    vi.mocked(serviceTokens.authenticate).mockRejectedValueOnce(new UnauthorizedException());
    await tokenRequest()(request(app).post('/v1/secrets/resolve').send({})).expect(401);
    expect(secrets.resolve).not.toHaveBeenCalled();
  });

  it('rate limits resolve requests per token', async () => {
    rateLimit.check
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      });
    await tokenRequest()(request(app).post('/v1/secrets/resolve').send({})).expect(200);
    await tokenRequest()(request(app).post('/v1/secrets/resolve').send({})).expect(429);
  });
});
