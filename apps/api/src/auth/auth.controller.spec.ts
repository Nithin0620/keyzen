import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { RouteDependencies } from '../container';
import type { Express } from 'express';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { RateLimitService } from './rate-limit.service';
import { TokenService } from './token.service';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

describe('AuthController', () => {
  let app: Express;
  let auth: AuthService;
  let google: GoogleService;
  let tokenService: TokenService;
  let accessToken: string;
  const profile = { id: 'user-1', email: 'test@example.com', emailVerified: true };

  beforeEach(() => {
    tokenService = new TokenService();
    accessToken = tokenService.signAccess({ sub: 'user-1', email: profile.email, emailVerified: true });
    auth = {
      signup: vi.fn(async () => ({ message: 'If the email is eligible, a verification link has been sent' })),
      verifyEmail: vi.fn(async () => ({ message: 'Email verified' })),
      login: vi.fn(async () => ({ accessToken, refreshToken: 'refresh-1', user: profile })),
      refresh: vi.fn(async () => ({ accessToken, refreshToken: 'refresh-2' })),
      logout: vi.fn(async () => undefined),
      requestPasswordReset: vi.fn(async () => ({ message: 'If the account exists, a reset link has been sent' })),
      confirmPasswordReset: vi.fn(async () => ({ message: 'Password updated' })),
      getProfile: vi.fn(async () => profile),
      updateProfile: vi.fn(async () => ({ ...profile, name: 'Updated' })),
      googleSignIn: vi.fn(async () => ({ accessToken, refreshToken: 'refresh-3', user: profile })),
    } as unknown as AuthService;
    google = {
      authorizationUrl: vi.fn(() => 'https://accounts.example.com/auth'),
      verifyCode: vi.fn(async () => ({ sub: 'g-1', email: profile.email, emailVerified: true })),
    } as unknown as GoogleService;

    const deps: RouteDependencies = {
      audits: { record: vi.fn(async () => undefined) } as any,
      tokens: tokenService,
      policy: { evaluate: vi.fn(async () => true) } as any,
      auth,
      google,
      rateLimit: new RateLimitService(),
      workspaces: {} as any,
      projects: {} as any,
      secrets: {} as any,
      rotation: {} as any,
      serviceTokens: {} as any,
    };
    app = createApp(deps);
  });

  it('signup normalizes email, rejects weak input and returns a generic response', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({ email: 'Test@Example.com', password: 'correct-horse-battery' })
      .expect(202);
    expect(response.body.message).toContain('If the email is eligible');
    expect(auth.signup).toHaveBeenCalledWith({ email: 'test@example.com', password: 'correct-horse-battery' });

    await request(app).post('/auth/signup').send({ email: 'bad', password: 'short' }).expect(400);
  });

  it('verifies, logs in with cookies, refreshes, reads profile and logs out', async () => {
    await request(app).post('/auth/verify').send({ token: 'x'.repeat(40) }).expect(200);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'correct-horse-battery' })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('aegis_access=');
    expect(cookies.join(';')).toContain('aegis_refresh=');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Lax');
    expect(login.body).toEqual({ user: profile });

    await request(app).post('/auth/refresh').send({ refreshToken: 'refresh-1' }).expect(200);
    await request(app).get('/auth/me').expect(401);
    await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated' })
      .expect(200);

    const logout = await request(app)
      .post('/auth/logout')
      .set('Cookie', 'aegis_refresh=refresh-2')
      .expect(200);
    expect(auth.logout).toHaveBeenCalledWith('refresh-2');
    expect((logout.headers['set-cookie'] as unknown as string[]).join(';')).toContain('aegis_access=;');
  });

  it('handles password reset request and confirmation', async () => {
    await request(app)
      .post('/auth/password-reset/request')
      .send({ email: 'test@example.com' })
      .expect(200);
    await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: 'x'.repeat(40), password: 'new-password-long' })
      .expect(200);
    expect(auth.confirmPasswordReset).toHaveBeenCalledWith('x'.repeat(40), 'new-password-long');
  });

  it('redirects to Google and exchanges the callback code into cookies', async () => {
    await request(app).get('/auth/google').expect(302).expect('Location', 'https://accounts.example.com/auth');
    const callback = await request(app).get('/auth/google/callback?code=oauth-code').expect(302);
    expect(callback.headers.location).toBe('http://localhost:3000');
    expect((callback.headers['set-cookie'] as unknown as string[]).join(';')).toContain('aegis_refresh=refresh-3');
    expect(google.verifyCode).toHaveBeenCalledWith('oauth-code');
  });

  it('rate limits signup, login, reset and OAuth callback', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/auth/signup').send({ email: 'test@example.com', password: 'correct-horse-battery' }).expect(202);
    }
    await request(app).post('/auth/signup').send({ email: 'test@example.com', password: 'correct-horse-battery' }).expect(429);

    for (let i = 0; i < 10; i += 1) {
      await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'correct-horse-battery' }).expect(200);
    }
    await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'correct-horse-battery' }).expect(429);

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/auth/password-reset/request').send({ email: 'test@example.com' }).expect(200);
    }
    await request(app).post('/auth/password-reset/request').send({ email: 'test@example.com' }).expect(429);

    for (let i = 0; i < 10; i += 1) {
      await request(app).get('/auth/google/callback?code=oauth-code').expect(302);
    }
    await request(app).get('/auth/google/callback?code=oauth-code').expect(429);
  });
});
