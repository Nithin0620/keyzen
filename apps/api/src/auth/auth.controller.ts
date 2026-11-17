import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
import type { Request, Response } from 'express';
import { AUTHENTICATED, RequirePermission } from '../authz/require-permission.decorator';
import { validateEnv } from '../config/env';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { hashIp } from '../common/tokens';
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies } from '../common/cookies';
import type { SessionMetadata } from './types';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard';
import { RateLimitService } from './rate-limit.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(GoogleService) private readonly google: GoogleService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService
  ) {}

  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    this.rateLimit.check(`signup:${req.ip}`, 5, 60_000);
    res.status(202).json(await this.auth.signup(body));
  }

  @Post('verify')
  async verify(
    @Body(new ZodValidationPipe(tokenOnlySchema)) body: TokenOnlyInput,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    this.rateLimit.check(`verify:${req.ip}`, 10, 60_000);
    res.status(200).json(await this.auth.verifyEmail(body.token));
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    this.rateLimit.check(`login:${req.ip}`, 10, 60_000);
    const result = await this.auth.login(body.email, body.password, this.metadata(req));
    setAuthCookies(res, result.accessToken, result.refreshToken, this.secure());
    res.status(200).json({ user: result.user });
  }

  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const refreshToken = body.refreshToken ?? readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    this.rateLimit.check(`refresh:${req.ip}`, 30, 60_000);
    const result = await this.auth.refresh(refreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken, this.secure());
    res.status(200).json({ ok: true });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.secure());
    res.status(200).json({ ok: true });
  }

  @Post('password-reset/request')
  async requestReset(
    @Body(new ZodValidationPipe(passwordResetRequestSchema)) body: PasswordResetRequestInput,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    this.rateLimit.check(`reset:${req.ip}`, 5, 60_000);
    res.status(200).json(await this.auth.requestPasswordReset(body.email));
  }

  @Post('password-reset/confirm')
  async confirmReset(
    @Body(new ZodValidationPipe(passwordResetSchema)) body: PasswordResetInput,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    this.rateLimit.check(`reset-confirm:${req.ip}`, 10, 60_000);
    res.status(200).json(await this.auth.confirmPasswordReset(body.token, body.password));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AUTHENTICATED)
  async me(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    res.json(await this.auth.getProfile(req.user.sub));
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @RequirePermission(AUTHENTICATED)
  async updateMe(
    @Body(new ZodValidationPipe(profileUpdateSchema)) body: ProfileUpdateInput,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    res.json(await this.auth.updateProfile(req.user.sub, body.name));
  }

  @Get('google')
  startGoogle(@Res() res: Response): void {
    res.redirect(this.google.authorizationUrl());
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    if (!code) {
      throw new UnauthorizedException();
    }
    this.rateLimit.check(`oauth:${req.ip}`, 10, 60_000);
    const result = await this.auth.googleSignIn(await this.google.verifyCode(code), this.metadata(req));
    setAuthCookies(res, result.accessToken, result.refreshToken, this.secure());
    res.redirect(validateEnv().WEB_ORIGIN);
  }

  private metadata(req: Request): SessionMetadata {
    const userAgent = req.headers['user-agent'];
    return {
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : undefined,
      ipHash: hashIp(req.ip ?? ''),
    };
  }

  private secure(): boolean {
    return validateEnv().NODE_ENV === 'production';
  }
}
