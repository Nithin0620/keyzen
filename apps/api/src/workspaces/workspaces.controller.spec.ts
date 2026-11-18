import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { RateLimitService } from '../auth/rate-limit.service';
import { TokenService } from '../auth/token.service';
import { ForbiddenException } from '../common/http-error';
import type { RouteDependencies } from '../container';
import type { WorkspacesService } from './workspaces.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';
const INVITATION_ID = '507f1f77bcf86cd799439013';
const ACTOR_ID = '507f1f77bcf86cd799439099';

const workspaceView = {
  id: WORKSPACE_ID,
  name: 'Core',
  slug: 'core',
  settings: {},
  ownerId: ACTOR_ID,
  role: 'OWNER',
  active: true,
};
const memberView = { userId: USER_ID, email: 'member@example.com', role: 'MEMBER' };
const invitationView = {
  id: INVITATION_ID,
  workspaceId: WORKSPACE_ID,
  email: 'invitee@example.com',
  role: 'MEMBER',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  status: 'PENDING',
};

describe('WorkspacesController', () => {
  let app: Express;
  let service: WorkspacesService;
  let accessToken: string;

  beforeEach(() => {
    const tokens = new TokenService();
    accessToken = tokens.signAccess({ sub: ACTOR_ID, email: 'owner@example.com', emailVerified: true });
    service = {
      create: vi.fn(async () => workspaceView),
      list: vi.fn(async () => [workspaceView]),
      getActive: vi.fn(async () => workspaceView),
      get: vi.fn(async () => workspaceView),
      select: vi.fn(async () => workspaceView),
      update: vi.fn(async () => ({ ...workspaceView, name: 'Renamed' })),
      remove: vi.fn(async () => undefined),
      listMembers: vi.fn(async () => [memberView]),
      changeRole: vi.fn(async () => ({ ...memberView, role: 'ADMIN' })),
      removeMember: vi.fn(async () => undefined),
      transferOwner: vi.fn(async () => workspaceView),
      invite: vi.fn(async () => invitationView),
      listInvitations: vi.fn(async () => [invitationView]),
      acceptInvitation: vi.fn(async () => workspaceView),
      declineInvitation: vi.fn(async () => undefined),
      revokeInvitation: vi.fn(async () => undefined),
    } as unknown as WorkspacesService;

    const deps: RouteDependencies = {
      audits: { record: vi.fn(async () => undefined), list: vi.fn(async () => []) } as any,
      tokens,
      policy: { evaluate: vi.fn(async () => true) } as any,
      auth: {} as any,
      google: {} as any,
      rateLimit: new RateLimitService(),
      workspaces: service,
      projects: {} as any,
      secrets: {} as any,
      rotation: {} as any,
      serviceTokens: {} as any,
    };
    app = createApp(deps);
  });

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

  it('creates, lists, reads, selects and reads the active workspace from the session', async () => {
    const created = await authed().post('/workspaces').send({ name: 'Core', slug: 'Core', settings: { region: 'us' } }).expect(201);
    expect(service.create).toHaveBeenCalledWith(ACTOR_ID, { name: 'Core', slug: 'core', settings: { region: 'us' } });
    expect(created.body).toEqual(workspaceView);

    expect((await authed().get('/workspaces').expect(200)).body).toEqual([workspaceView]);
    expect((await authed().get('/workspaces/active').expect(200)).body).toEqual(workspaceView);
    expect(service.getActive).toHaveBeenCalledWith(ACTOR_ID);

    expect((await authed().get(`/workspaces/${WORKSPACE_ID}`).expect(200)).body).toEqual(workspaceView);
    expect(service.get).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID);

    expect((await authed().post(`/workspaces/${WORKSPACE_ID}/select`).expect(200)).body).toEqual(workspaceView);
    expect(service.select).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID);
  });

  it('updates and deletes a workspace only with an explicit confirmation', async () => {
    expect((await authed().patch(`/workspaces/${WORKSPACE_ID}`).send({ name: 'Renamed' }).expect(200)).body.name).toBe('Renamed');
    await authed().delete(`/workspaces/${WORKSPACE_ID}`).send({ confirmation: 'core' }).expect(200);
    expect(service.remove).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, 'core');

    await authed().delete(`/workspaces/${WORKSPACE_ID}`).send({}).expect(400);
  });

  it('manages members and transfers ownership through guarded routes', async () => {
    expect((await authed().get(`/workspaces/${WORKSPACE_ID}/members`).expect(200)).body).toEqual([memberView]);
    expect((await authed().patch(`/workspaces/${WORKSPACE_ID}/members/${USER_ID}`).send({ role: 'ADMIN' }).expect(200)).body.role).toBe('ADMIN');
    await authed().delete(`/workspaces/${WORKSPACE_ID}/members/${USER_ID}`).expect(200);
    expect(service.removeMember).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, USER_ID);

    expect(
      (
        await authed()
          .post(`/workspaces/${WORKSPACE_ID}/transfer-owner`)
          .send({ userId: USER_ID, confirmation: 'core' })
          .expect(200)
      ).body
    ).toEqual(workspaceView);
    expect(service.transferOwner).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, USER_ID, 'core');
  });

  it('sends, lists, accepts, declines and revokes invitations', async () => {
    expect(
      (await authed().post(`/workspaces/${WORKSPACE_ID}/invitations`).send({ email: 'Invitee@Example.com', role: 'MEMBER' }).expect(201)).body
    ).toEqual(invitationView);
    expect(service.invite).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, { email: 'invitee@example.com', role: 'MEMBER' });
    expect((await authed().get(`/workspaces/${WORKSPACE_ID}/invitations`).expect(200)).body).toEqual([invitationView]);

    const token = 'x'.repeat(40);
    expect((await authed().post('/workspaces/invitations/accept').send({ token }).expect(200)).body).toEqual(workspaceView);
    expect(service.acceptInvitation).toHaveBeenCalledWith(ACTOR_ID, token);
    await authed().post('/workspaces/invitations/decline').send({ token }).expect(200);
    expect(service.declineInvitation).toHaveBeenCalledWith(ACTOR_ID, token);

    await authed().post(`/workspaces/${WORKSPACE_ID}/invitations/${INVITATION_ID}/revoke`).expect(200);
    expect(service.revokeInvitation).toHaveBeenCalledWith(ACTOR_ID, WORKSPACE_ID, INVITATION_ID);
  });

  it('rejects unauthenticated requests, invalid ids and service-level denials', async () => {
    await request(app).get('/workspaces').expect(401);
    await authed().get('/workspaces/not-an-id').expect(400);

    vi.mocked(service.get).mockRejectedValueOnce(new ForbiddenException('Workspace access denied'));
    await authed().get(`/workspaces/${WORKSPACE_ID}`).expect(403);
  });
});
