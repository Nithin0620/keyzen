import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';
import type { ProjectsService } from './projects.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439013';
const ENVIRONMENT_ID = '507f1f77bcf86cd799439014';
const OTHER_ENVIRONMENT_ID = '507f1f77bcf86cd799439015';
const ACTOR_ID = '507f1f77bcf86cd799439099';

describe('ProjectsController', () => {
  let app: Express;
  let projects: ProjectsService;
  let accessToken: string;

  beforeEach(() => {
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

    const tokens = new TokenService();
    accessToken = tokens.signAccess({ sub: ACTOR_ID, email: 'owner@example.com', emailVerified: true });
    const deps: RouteDependencies = {
      audits: { record: vi.fn(async () => undefined), list: vi.fn(async () => []) } as any,
      tokens,
      policy: { evaluate: vi.fn(async () => true) } as any,
      auth: {} as any,
      google: {} as any,
      rateLimit: {} as any,
      workspaces: {} as any,
      projects,
      secrets: {} as any,
      rotation: {} as any,
      serviceTokens: {} as any,
    };
    app = createApp(deps);
  });

  const base = `/workspaces/${WORKSPACE_ID}/projects`;
  const project = `${base}/${PROJECT_ID}`;
  const environment = `${project}/environments/${ENVIRONMENT_ID}`;

  function authed() {
    const appRequest = request(app);
    const withAuth = (test: any) => test.set('Authorization', `Bearer ${accessToken}`);
    return {
      get: (url: string) => withAuth(appRequest.get(url)),
      post: (url: string) => withAuth(appRequest.post(url)),
      patch: (url: string) => withAuth(appRequest.patch(url)),
      delete: (url: string) => withAuth(appRequest.delete(url)),
    };
  }

  it('exposes project create, read, update, archive, restore and typed delete', async () => {
    expect((await authed().post(base).send({ name: 'Payments', slug: 'payments' }).expect(201)).body.slug).toBe('payments');
    expect(projects.create).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, { name: 'Payments', slug: 'payments' });
    await authed().get(base).expect(200);
    await authed().get(project).expect(200);
    expect((await authed().patch(project).send({ name: 'Billing' }).expect(200)).body.name).toBe('Billing');
    await authed().post(`${project}/archive`).expect(200);
    await authed().post(`${project}/restore`).expect(200);
    await authed().delete(project).send({ confirmation: 'payments' }).expect(200);
    expect(projects.remove).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, 'payments');
    await authed().delete(project).send({}).expect(400);
  });

  it('exposes project membership routes', async () => {
    await authed().get(`${project}/members`).expect(200);
    await authed().post(`${project}/members`).send({ email: 'Member@Example.com', role: 'VIEWER' }).expect(201);
    expect(projects.addMember).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, {
      email: 'member@example.com',
      role: 'VIEWER',
      customPermissions: [],
    });
    await authed().patch(`${project}/members/${USER_ID}`).send({ role: 'ADMIN' }).expect(200);
    expect(projects.changeMemberRole).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, USER_ID, {
      role: 'ADMIN',
    });
    await authed().delete(`${project}/members/${USER_ID}`).expect(200);
    expect(projects.removeMember).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, USER_ID);
  });

  it('exposes environment CRUD, duplicate, diff and runtime resolution', async () => {
    const environments = `${project}/environments`;
    await authed().post(environments).send({ name: 'dev', slug: 'dev' }).expect(201);
    await authed().get(environments).expect(200);
    await authed().get(environment).expect(200);
    await authed().patch(environment).send({ name: 'development' }).expect(200);
    await authed().post(`${environment}/archive`).expect(200);
    await authed().post(`${environment}/restore`).expect(200);
    await authed().post(`${environment}/duplicate`).send({ name: 'staging', slug: 'staging' }).expect(200);
    await authed().get(`${project}/environments/${ENVIRONMENT_ID}/diff/${OTHER_ENVIRONMENT_ID}`).expect(200);
    await authed().get(`${environment}/resolve`).expect(200);
    await authed().delete(environment).send({ confirmation: 'dev' }).expect(200);
    expect(projects.removeEnvironment).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, PROJECT_ID, ENVIRONMENT_ID, 'dev');
  });

  it('rejects invalid object ids and malformed bodies', async () => {
    await authed().get(`${base}/not-an-id`).expect(400);
    await authed().post(base).send({ name: 'Payments', slug: 'Bad Slug' }).expect(400);
  });
});
