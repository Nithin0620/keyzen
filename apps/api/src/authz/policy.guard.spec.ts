import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenService } from '../auth/token.service';
import { HealthController } from '../health/health.controller';
import { PolicyGuard } from './policy.guard';
import { PolicyService } from './policy.service';
import { RequirePermission } from './require-permission.decorator';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

@Controller('secure')
class TestController {
  @Get('data')
  @RequirePermission('secrets.read')
  data() {
    return { ok: true };
  }

  @Get('unannotated')
  unannotated() {
    return { ok: true };
  }
}

describe('PolicyGuard', () => {
  let app: INestApplication;
  let policy: { evaluate: ReturnType<typeof vi.fn> };
  let token: string;

  beforeEach(async () => {
    const tokens = new TokenService();
    token = tokens.signAccess({ sub: '507f1f77bcf86cd799439099', email: 'user@example.com', emailVerified: true });
    policy = { evaluate: vi.fn(async () => false) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, TestController],
      providers: [
        TokenService,
        { provide: PolicyService, useValue: policy },
        { provide: APP_GUARD, useClass: PolicyGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows public routes without authentication or policy evaluation', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    expect(policy.evaluate).not.toHaveBeenCalled();
  });

  it('authenticates protected routes and returns 403 when the policy denies', async () => {
    await request(app.getHttpServer()).get('/secure/data').expect(401);
    await request(app.getHttpServer()).get('/secure/data').set('Authorization', `Bearer ${token}`).expect(403);
    expect(policy.evaluate).toHaveBeenCalledWith('507f1f77bcf86cd799439099', 'secrets.read', {
      workspaceId: undefined,
      projectId: undefined,
    });
  });

  it('allows protected routes when the policy grants', async () => {
    policy.evaluate.mockResolvedValueOnce(true);
    await request(app.getHttpServer()).get('/secure/data').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('denies routes without permission metadata', async () => {
    await request(app.getHttpServer()).get('/secure/unannotated').set('Authorization', `Bearer ${token}`).expect(403);
    expect(policy.evaluate).not.toHaveBeenCalled();
  });
});
