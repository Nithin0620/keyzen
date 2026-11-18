import type { Request, RequestHandler, Response } from 'express';
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  profileUpdateSchema,
  refreshSchema,
  signupSchema,
  tokenOnlySchema,
  type LoginInput,
  type PasswordResetInput,
  type PasswordResetRequestInput,
  type ProfileUpdateInput,
  type RefreshInput,
  type SignupInput,
  type TokenOnlyInput,
} from '@aegis/shared';
import { AUTHENTICATED, defineRoute } from '../authz/route-manifest';
import { UnauthorizedException } from '../common/http-error';
import { validate } from '../common/zod-validation.pipe';
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies } from '../common/cookies';
import { hashIp } from '../common/tokens';
import { validateEnv } from '../config/env';
import type { ManagedRoute } from '../http/router';
import type { SessionMetadata } from './types';
import type { AuthService } from './auth.service';
import type { GoogleService } from './google.service';
import type { RateLimitService } from './rate-limit.service';
import type { AuthenticatedRequest } from './jwt-auth.guard';

interface AuthRouteDependencies {
  auth: AuthService;
  google: GoogleService;
  rateLimit: RateLimitService;
}

export function createAuthRoutes(deps: AuthRouteDependencies): ManagedRoute[] {
  const metadata = (req: Request): SessionMetadata => {
    const userAgent = req.headers['user-agent'];
    return {
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : undefined,
      ipHash: hashIp(req.ip ?? ''),
    };
  };

  const secure = (): boolean => validateEnv().NODE_ENV === 'production';

  const signup: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`signup:${req.ip}`, 5, 60_000);
    res.status(202).json(await deps.auth.signup(req.body as SignupInput));
  };

  const verify: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`verify:${req.ip}`, 10, 60_000);
    res.status(200).json(await deps.auth.verifyEmail((req.body as TokenOnlyInput).token));
  };

  const login: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`login:${req.ip}`, 10, 60_000);
    const body = req.body as LoginInput;
    const result = await deps.auth.login(body.email, body.password, metadata(req));
    setAuthCookies(res, result.accessToken, result.refreshToken, secure());
    res.status(200).json({ user: result.user });
  };

  const refresh: RequestHandler = async (req, res) => {
    const body = req.body as RefreshInput;
    const refreshToken = body.refreshToken ?? readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    deps.rateLimit.check(`refresh:${req.ip}`, 30, 60_000);
    const result = await deps.auth.refresh(refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken, secure());
    res.status(200).json({ ok: true });
  };

  const logout: RequestHandler = async (req, res) => {
    await deps.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, secure());
    res.status(200).json({ ok: true });
  };

  const requestReset: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`reset:${req.ip}`, 5, 60_000);
    res.status(200).json(await deps.auth.requestPasswordReset((req.body as PasswordResetRequestInput).email));
  };

  const confirmReset: RequestHandler = async (req, res) => {
    deps.rateLimit.check(`reset-confirm:${req.ip}`, 10, 60_000);
    const body = req.body as PasswordResetInput;
    res.status(200).json(await deps.auth.confirmPasswordReset(body.token, body.password));
  };

  const me: RequestHandler = async (req, res) => {
    res.json(await deps.auth.getProfile((req as AuthenticatedRequest).user.sub));
  };

  const updateMe: RequestHandler = async (req, res) => {
    res.json(
      await deps.auth.updateProfile(
        (req as AuthenticatedRequest).user.sub,
        (req.body as ProfileUpdateInput).name
      )
    );
  };

  const startGoogle: RequestHandler = (_req, res) => {
    res.redirect(deps.google.authorizationUrl());
  };

  const googleCallback: RequestHandler = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      throw new UnauthorizedException();
    }
    deps.rateLimit.check(`oauth:${req.ip}`, 10, 60_000);
    const result = await deps.auth.googleSignIn(await deps.google.verifyCode(code), metadata(req));
    setAuthCookies(res, result.accessToken, result.refreshToken, secure());
    res.redirect(validateEnv().WEB_ORIGIN);
  };

  return [
    defineRoute({
      name: 'auth.signup',
      method: 'post',
      path: '/auth/signup',
      public: true,
      middlewares: [validate(signupSchema)],
      handler: signup,
    }),
    defineRoute({
      name: 'auth.verify',
      method: 'post',
      path: '/auth/verify',
      public: true,
      middlewares: [validate(tokenOnlySchema)],
      handler: verify,
    }),
    defineRoute({
      name: 'auth.login',
      method: 'post',
      path: '/auth/login',
      public: true,
      middlewares: [validate(loginSchema)],
      handler: login,
    }),
    defineRoute({
      name: 'auth.refresh',
      method: 'post',
      path: '/auth/refresh',
      public: true,
      middlewares: [validate(refreshSchema)],
      handler: refresh,
    }),
    defineRoute({
      name: 'auth.logout',
      method: 'post',
      path: '/auth/logout',
      public: true,
      handler: logout,
    }),
    defineRoute({
      name: 'auth.passwordResetRequest',
      method: 'post',
      path: '/auth/password-reset/request',
      public: true,
      middlewares: [validate(passwordResetRequestSchema)],
      handler: requestReset,
    }),
    defineRoute({
      name: 'auth.passwordResetConfirm',
      method: 'post',
      path: '/auth/password-reset/confirm',
      public: true,
      middlewares: [validate(passwordResetSchema)],
      handler: confirmReset,
    }),
    defineRoute({
      name: 'auth.me',
      method: 'get',
      path: '/auth/me',
      permission: AUTHENTICATED,
      handler: me,
    }),
    defineRoute({
      name: 'auth.updateMe',
      method: 'patch',
      path: '/auth/me',
      permission: AUTHENTICATED,
      middlewares: [validate(profileUpdateSchema)],
      handler: updateMe,
    }),
    defineRoute({
      name: 'auth.google',
      method: 'get',
      path: '/auth/google',
      public: true,
      handler: startGoogle,
    }),
    defineRoute({
      name: 'auth.googleCallback',
      method: 'get',
      path: '/auth/google/callback',
      public: true,
      handler: googleCallback,
    }),
  ];
}
