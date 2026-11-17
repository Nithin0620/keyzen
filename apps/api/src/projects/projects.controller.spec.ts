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
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';
const ENVIRONMENT_ID = '507f1f77bcf86cd799439014';
const OTHER_ENVIRONMENT_ID = '507f1f77bcf86cd799439015';
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

describe('ProjectsController', () => {
  let app: INestApplication;
  let projects: ProjectsService;

  beforeEach(async () => {
    const projectView = { id: PROJECT_ID, slug: 'payments', name: 'Payments', archived: false, settings: {} };
    const environmentView = { id: ENVIRONMENT_ID, projectId: PROJECT_ID, slug: 'dev', name: 'dev', archived: false };
    projects = {
      create: vi.fn(async () => projectView),
      list: vi.fn(async () => [projectView]),
      get: vi.fn(async () => projectView),
      update: vi.fn(async () => ({ ...projectView, name: 'Billing' })),
      remove: vi.fn(async () => undefined),
      archive: vi.fn(async () => ({ ...projectView, archived: true })),
      restore: vi.fn(async () => projectView),
      listMembers: vi.fn(async () => [{ userId: USER_ID, email: 'member@example.com', role: 'MEMBER' }]),
      addMember: vi.fn(async () => ({ userId: USER_ID, email: 'member@example.com', role: 'MEMBER' })),
      changeMemberRole: vi.fn(async () => ({ userId: USER_ID, email: 'member@example.com', role: 'ADMIN' })),
      removeMember: vi.fn(async () => undefined),
      createEnvironment: vi.fn(async () => environmentView),
      listEnvironments: vi.fn(async () => [environmentView]),
      getEnvironment: vi.fn(async () => environmentView),
      updateEnvironment: vi.fn(async () => ({ ...environmentView, name: 'development' })),
      removeEnvironment: vi.fn(async () => undefined),
      archiveEnvironment: vi.fn(async () => ({ ...environmentView, archived: true })),
      restoreEnvironment: vi.fn(async () => environmentView),
      duplicateEnvironment: vi.fn(async () => ({ ...environmentView, id: OTHER_ENVIRONMENT_ID, slug: 'staging' })),
      diffEnvironments: vi.fn(async () => ({ items: [] })),
      resolveEnvironment: vi.fn(async () => ({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID })),
    } as unknown as ProjectsService;

    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projects },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const base = `/workspaces/${WORKSPACE_ID}/projects`;
  const project = `${base}/${PROJECT_ID}`;
  const environment = `${project}/environments/${ENVIRONMENT_ID}`;

  it('exposes project create, read, update, archive, restore and typed delete', async () => {
    expect((await request(app.getHttpServer()).post(base).send({ name: 'Payments', slug: 'payments' }).expect(201)).body.slug).toBe('payments');
    expect(projects.create).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, { name: 'Payments', slug: 'payments' });
    await request(app.getHttpServer()).get(base).expect(200);
    await request(app.getHttpServer()).get(project).expect(200);
    expect((await request(app.getHttpServer()).patch(project).send({ name: 'Billing' }).expect(200)).body.name).toBe('Billing');
    await request(app.getHttpServer()).post(`${project}/archive`).expect(200);
    await request(app.getHttpServer()).post(`${project}/restore`).expect(200);
    await request(app.getHttpServer()).delete(project).send({ confirmation: 'payments' }).expect(200);
    expect(projects.remove).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, 'payments');
    await request(app.getHttpServer()).delete(project).send({}).expect(400);
  });

  it('exposes project membership routes', async () => {
    await request(app.getHttpServer()).get(`${project}/members`).expect(200);
    await request(app.getHttpServer()).post(`${project}/members`).send({ email: 'Member@Example.com', role: 'VIEWER' }).expect(201);
    expect(projects.addMember).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, {
      email: 'member@example.com',
      role: 'VIEWER',
      customPermissions: [],
    });
    await request(app.getHttpServer()).patch(`${project}/members/${USER_ID}`).send({ role: 'ADMIN' }).expect(200);
    await request(app.getHttpServer()).delete(`${project}/members/${USER_ID}`).expect(200);
  });

  it('exposes environment CRUD, duplicate, diff and runtime resolution', async () => {
    const environments = `${project}/environments`;
    await request(app.getHttpServer()).post(environments).send({ name: 'dev', slug: 'dev' }).expect(201);
    await request(app.getHttpServer()).get(environments).expect(200);
    await request(app.getHttpServer()).get(environment).expect(200);
    await request(app.getHttpServer()).patch(environment).send({ name: 'development' }).expect(200);
    await request(app.getHttpServer()).post(`${environment}/archive`).expect(200);
    await request(app.getHttpServer()).post(`${environment}/restore`).expect(200);
    await request(app.getHttpServer()).post(`${environment}/duplicate`).send({ name: 'staging', slug: 'staging' }).expect(200);
    await request(app.getHttpServer()).get(`${project}/environments/${ENVIRONMENT_ID}/diff/${OTHER_ENVIRONMENT_ID}`).expect(200);
    await request(app.getHttpServer()).get(`${environment}/resolve`).expect(200);
    await request(app.getHttpServer()).delete(environment).send({ confirmation: 'dev' }).expect(200);
    expect(projects.removeEnvironment).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, ENVIRONMENT_ID, 'dev');
  });

  it('rejects invalid object ids and malformed bodies', async () => {
    await request(app.getHttpServer()).get(`${base}/not-an-id`).expect(400);
    await request(app.getHttpServer()).post(base).send({ name: 'Payments', slug: 'Bad Slug' }).expect(400);
  });
});
