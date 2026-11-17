import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import argon2 from 'argon2';
import { Types, type ClientSession, type Connection, type Model } from 'mongoose';
import { validateEnv } from '../config/env';
import { hashToken, randomToken } from '../common/tokens';
import {
  OAUTH_ACCOUNT_MODEL,
  SESSION_MODEL,
  USER_MODEL,
  VERIFICATION_TOKEN_MODEL,
} from '../database/schemas';
import { withTransaction } from '../database/transaction';
import type { SignupInput } from '@aegis/shared';
import type { GoogleIdentity } from './google.service';
import { MailService, type MailKind } from './mail.service';
import { TokenService } from './token.service';
import type { AuthTokens, Profile, SessionMetadata, SessionRecord, UserRecord, VerificationRecord } from './types';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(USER_MODEL) private readonly users: Model<UserRecord>,
    @InjectModel(SESSION_MODEL) private readonly sessions: Model<SessionRecord>,
    @InjectModel(VERIFICATION_TOKEN_MODEL) private readonly verifications: Model<VerificationRecord>,
    @InjectModel(OAUTH_ACCOUNT_MODEL) private readonly oauthAccounts: Model<{ userId: Types.ObjectId; provider: string; providerUserId: string }>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(MailService) private readonly mail: MailService
  ) {}

  async signup(input: SignupInput): Promise<{ message: string }> {
    const email = normalizeEmail(input.email);
    const existing = await this.users.findOne({ email }).exec();

    if (!existing) {
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      const user = await this.users.create({
        email,
        name: input.name,
        passwordHash,
        emailVerifiedAt: null,
        status: 'ACTIVE',
      });
      await this.sendToken(user._id.toString(), email, 'EMAIL_VERIFY');
    } else if (!existing.emailVerifiedAt) {
      await this.sendToken(existing._id.toString(), email, 'EMAIL_VERIFY');
    }

    return { message: 'If the email is eligible, a verification link has been sent' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.findToken(token, 'EMAIL_VERIFY');
    await withTransaction(this.connection, async (session) => {
      await this.verifications.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } }, { session });
      await this.users.updateOne(
        { _id: record.userId },
        { $set: { emailVerifiedAt: new Date(), status: 'ACTIVE' } },
        { session }
      );
    });
    return { message: 'Email verified' };
  }

  async login(email: string, password: string, metadata: SessionMetadata = {}): Promise<AuthTokens & { user: Profile }> {
    const user = await this.users.findOne({ email: normalizeEmail(email) }).select('+passwordHash').exec();
    if (!user || user.status !== 'ACTIVE' || !user.passwordHash || !user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const issued = await this.issue(user._id.toString(), user.email, true, metadata);
    return { ...issued, user: this.profile(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const session = await this.sessions.findOne({ refreshTokenHash: hashToken(refreshToken) }).exec();
    if (!session) {
      throw new UnauthorizedException();
    }
    if (session.revokedAt) {
      await this.sessions.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      throw new UnauthorizedException();
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findById(session.userId).exec();
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    return withTransaction(this.connection, async (dbSession) => {
      const revoked = await this.sessions.updateOne(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session: dbSession }
      );
      if (revoked.modifiedCount !== 1) {
        throw new UnauthorizedException();
      }
      return this.issue(
        user._id.toString(),
        user.email,
        Boolean(user.emailVerifiedAt),
        {},
        session.familyId,
        dbSession
      );
    });
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }
    await this.sessions.updateOne(
      { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalized = normalizeEmail(email);
    const user = await this.users.findOne({ email: normalized }).exec();
    if (user) {
      await this.sendToken(user._id.toString(), normalized, 'PASSWORD_RESET');
    }
    return { message: 'If the account exists, a reset link has been sent' };
  }

  async confirmPasswordReset(token: string, password: string): Promise<{ message: string }> {
    const record = await this.findToken(token, 'PASSWORD_RESET');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await withTransaction(this.connection, async (session) => {
      await this.verifications.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } }, { session });
      await this.users.updateOne({ _id: record.userId }, { $set: { passwordHash } }, { session });
      await this.sessions.updateMany(
        { userId: record.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session }
      );
    });
    return { message: 'Password updated' };
  }

  async getProfile(userId: string): Promise<Profile> {
    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.profile(user);
  }

  async updateProfile(userId: string, name: string): Promise<Profile> {
    const user = await this.users.findByIdAndUpdate(userId, { $set: { name } }, { new: true, runValidators: true }).exec();
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.profile(user);
  }

  async googleSignIn(identity: GoogleIdentity, metadata: SessionMetadata = {}): Promise<AuthTokens & { user: Profile }> {
    if (!identity.emailVerified) {
      throw new UnauthorizedException();
    }
    const email = normalizeEmail(identity.email);

    let user = await this.users.findOne({ email }).exec();
    if (!user) {
      user = await this.users.create({
        email,
        name: identity.name,
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      });
    } else if (!user.emailVerifiedAt) {
      user = await this.users.findByIdAndUpdate(
        user._id,
        { $set: { emailVerifiedAt: new Date(), status: 'ACTIVE' } },
        { new: true }
      );
    }
    if (!user) {
      throw new UnauthorizedException();
    }

    await this.oauthAccounts.updateOne(
      { provider: 'google', providerUserId: identity.sub },
      { $set: { userId: user._id } },
      { upsert: true }
    );

    const issued = await this.issue(user._id.toString(), user.email, true, metadata);
    return { ...issued, user: this.profile(user) };
  }

  private profile(user: UserRecord): Profile {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private async sendToken(userId: string, email: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<void> {
    await this.verifications.updateMany({ userId: new Types.ObjectId(userId), type, usedAt: null }, { $set: { usedAt: new Date() } });
    const token = randomToken(32);
    const ttl = type === 'EMAIL_VERIFY' ? 24 * 60 * 60 : 60 * 60;
    await this.verifications.create({
      userId: new Types.ObjectId(userId),
      tokenHash: hashToken(token),
      type,
      expiresAt: new Date(Date.now() + ttl * 1000),
    });
    const kind: MailKind = type === 'EMAIL_VERIFY' ? 'verify' : 'reset';
    await this.mail.send(kind, email, token);
  }

  private async findToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<VerificationRecord> {
    const record = await this.verifications
      .findOne({ tokenHash: hashToken(token), type, usedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
    if (!record) {
      throw new BadRequestException('Invalid or expired token');
    }
    return record;
  }

  private async issue(
    userId: string,
    email: string,
    emailVerified: boolean,
    metadata: SessionMetadata = {},
    familyId = this.tokens.newFamilyId(),
    session?: ClientSession
  ): Promise<AuthTokens> {
    const refreshToken = this.tokens.newRefreshToken();
    const ttl = validateEnv().AUTH_REFRESH_TTL;
    const options = session ? { session } : undefined;
    await this.sessions.create(
      [
        {
          userId: new Types.ObjectId(userId),
          refreshTokenHash: hashToken(refreshToken),
          familyId,
          expiresAt: new Date(Date.now() + ttl * 1000),
          revokedAt: null,
          userAgent: metadata.userAgent,
          ipHash: metadata.ipHash,
        },
      ],
      options
    );
    const accessToken = this.tokens.signAccess({ sub: userId, email, emailVerified });
    return { accessToken, refreshToken };
  }
}
