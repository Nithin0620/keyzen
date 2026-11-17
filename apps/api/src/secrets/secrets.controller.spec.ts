import 'reflect-metadata';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  type INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyRotationService } from './key-rotation.service';
import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const SECRET_ID = '507f1f77bcf86cd799439013';
const ENVIRONMENT_ID = '507f1f77bcf86cd799439014';
const ACTOR_ID = '507f1f77bcf86cd799439099';

@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = {
      sub: ACTOR_ID,
      email: 'owner@example.com',
      emailVerified: true,
    };
    return true;
  }
}

describe('SecretsController', () => {
  let app: INestApplication;
  let secrets: SecretsService;
  let rotation: KeyRotationService;

  beforeEach(async () => {
    secrets = {
      create: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY', value: { present: true, masked: '••••••' } })),
      list: vi.fn(async () => []),
      get: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY' })),
      reveal: vi.fn(async () => ({ name: 'API_KEY', value: 'plaintext' })),
      update: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY' })),
      upsertValue: vi.fn(async () => ({ id: SECRET_ID, name: 'API_KEY' })),
      remove: vi.fn(async () => undefined),
      import: vi.fn(async () => ({ imported: 1 })),
      export: vi.fn(async () => ({ entries: [{ name: 'API_KEY', value: 'plaintext' }] })),
    } as unknown as SecretsService;
    rotation = {
      rotateProjectKeys: vi.fn(async () => ({ rotated: 1 })),
    } as unknown as KeyRotationService;

    const moduleRef = await Test.createTestingModule({
      controllers: [SecretsController],
      providers: [
        { provide: SecretsService, useValue: secrets },
        { provide: KeyRotationService, useValue: rotation },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const base = `/workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/secrets`;
  const secret = `${base}/${SECRET_ID}`;

  it('exposes secret create, list, get, reveal, update, value upsert and typed delete', async () => {
    const body = { environmentId: ENVIRONMENT_ID, name: 'API_KEY', value: 'plaintext' };
    expect((await request(app.getHttpServer()).post(base).send(body).expect(201)).body.id).toBe(SECRET_ID);
    expect(secrets.create).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, body);
    await request(app.getHttpServer()).get(base).query({ environmentId: ENVIRONMENT_ID }).expect(200);
    await request(app.getHttpServer()).get(secret).query({ environmentId: ENVIRONMENT_ID }).expect(200);
    expect(
      (await request(app.getHttpServer()).get(`${secret}/reveal`).query({ environmentId: ENVIRONMENT_ID }).expect(200)).body.value
    ).toBe('plaintext');
    await request(app.getHttpServer()).patch(secret).send({ description: 'primary' }).expect(200);
    await request(app.getHttpServer())
      .put(`${secret}/environments/${ENVIRONMENT_ID}/value`)
      .send({ value: 'new-value' })
      .expect(200);
    await request(app.getHttpServer()).delete(secret).send({ confirmation: 'API_KEY' }).expect(200);
    expect(secrets.remove).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, SECRET_ID, 'API_KEY');
  });

  it('exposes import, export and key rotation routes', async () => {
    expect(
      (await request(app.getHttpServer())
        .post(`${base}/import`)
        .send({ environmentId: ENVIRONMENT_ID, contents: 'API_KEY=value' })
        .expect(201)).body.imported
    ).toBe(1);
    expect(
      (await request(app.getHttpServer()).get(`${base}/export`).query({ environmentId: ENVIRONMENT_ID }).expect(200))
        .body.entries[0].name
    ).toBe('API_KEY');
    expect(
      (await request(app.getHttpServer())
        .post(`${base}/keys/rotate`)
        .send({ targetKeyId: 'env-master-v2' })
        .expect(201)).body.rotated
    ).toBe(1);
    expect(rotation.rotateProjectKeys).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, 'env-master-v2');
  });

  it('rejects invalid ids and malformed secret bodies', async () => {
    await request(app.getHttpServer()).get(`${base}/not-an-id`).expect(400);
    await request(app.getHttpServer()).post(base).send({ name: 'bad name', value: 'x' }).expect(400);
    await request(app.getHttpServer()).post(`${base}/import`).send({ contents: 'API_KEY=value' }).expect(400);
  });
});
