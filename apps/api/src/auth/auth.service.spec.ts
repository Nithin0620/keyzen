import { UnauthorizedException } from '@nestjs/common';
import type { ClientSession, Connection, Model } from 'mongoose';
import { Types } from 'mongoose';
import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { TokenService } from './token.service';
import type { SessionRecord, UserRecord, VerificationRecord } from './types';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

type Doc = Record<string, any>;

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && '$gt' in expected) {
      return actual instanceof Date && actual.getTime() > expected.$gt.getTime();
    }
    if (expected instanceof Types.ObjectId || actual instanceof Types.ObjectId) {
      return String(actual) === String(expected);
    }
    return actual === expected;
  });
}

function query<T>(value: T | null) {
  const result = {
    select: () => result,
    exec: async () => value,
  };
  return result;
}

function applyUpdate(doc: Doc, update: Doc): void {
  if (update.$set) {
    Object.assign(doc, update.$set);
  } else {
    Object.assign(doc, update);
  }
}

function fakeConnection(): Connection {
  const session = {
    withTransaction: vi.fn(async (work: () => Promise<void>) => {
      await work();
    }),
    endSession: vi.fn(async () => undefined),
  } as unknown as ClientSession;
  return { startSession: vi.fn(async () => session) } as unknown as Connection;
}

describe('AuthService', () => {
  let users: Doc[];
  let sessions: Doc[];
  let verifications: Doc[];
  let oauthAccounts: Doc[];
  let userModel: Model<UserRecord>;
  let sessionModel: Model<SessionRecord>;
  let verificationModel: Model<VerificationRecord>;
  let oauthModel: Model<{ userId: Types.ObjectId; provider: string; providerUserId: string }>;
  let mail: MailService;
  let service: AuthService;

  beforeEach(() => {
    users = [];
    sessions = [];
    verifications = [];
    oauthAccounts = [];

    userModel = {
      findOne: vi.fn((filter: Doc) => query(users.find((doc) => matches(doc, filter)) ?? null)),
      findById: vi.fn((id: unknown) => query(users.find((doc) => String(doc._id) === String(id)) ?? null)),
      findByIdAndUpdate: vi.fn((id: unknown, update: Doc) => {
        const doc = users.find((item) => String(item._id) === String(id));
        if (!doc) {
          return query(null);
        }
        applyUpdate(doc, update);
        return query(doc);
      }),
      create: vi.fn(async (doc: Doc) => {
        const created = { _id: new Types.ObjectId(), ...doc };
        users.push(created);
        return created;
      }),
      updateOne: vi.fn(async (filter: Doc, update: Doc) => {
        const doc = users.find((item) => matches(item, filter));
        if (!doc) {
          return { modifiedCount: 0 };
        }
        applyUpdate(doc, update);
        return { modifiedCount: 1 };
      }),
      updateMany: vi.fn(async () => ({ modifiedCount: users.length })),
    } as unknown as Model<UserRecord>;

    sessionModel = {
      findOne: vi.fn((filter: Doc) => query(sessions.find((doc) => matches(doc, filter)) ?? null)),
      create: vi.fn(async (docs: Doc[]) => {
        const created = docs.map((doc) => ({ _id: new Types.ObjectId(), ...doc }));
        sessions.push(...created);
        return created;
      }),
      updateOne: vi.fn(async (filter: Doc, update: Doc) => {
        const doc = sessions.find((item) => matches(item, filter));
        if (!doc) {
          return { modifiedCount: 0 };
        }
        applyUpdate(doc, update);
        return { modifiedCount: 1 };
      }),
      updateMany: vi.fn(async (filter: Doc, update: Doc) => {
        let count = 0;
        for (const doc of sessions) {
          if (matches(doc, filter)) {
            applyUpdate(doc, update);
            count += 1;
          }
        }
        return { modifiedCount: count };
      }),
    } as unknown as Model<SessionRecord>;

    verificationModel = {
      findOne: vi.fn((filter: Doc) => query(verifications.find((doc) => matches(doc, filter)) ?? null)),
      create: vi.fn(async (doc: Doc) => {
        const created = { _id: new Types.ObjectId(), usedAt: null, ...doc };
        verifications.push(created);
        return created;
      }),
      updateOne: vi.fn(async (filter: Doc, update: Doc) => {
        const doc = verifications.find((item) => matches(item, filter));
        if (!doc) {
          return { modifiedCount: 0 };
        }
        applyUpdate(doc, update);
        return { modifiedCount: 1 };
      }),
      updateMany: vi.fn(async (filter: Doc, update: Doc) => {
        let count = 0;
        for (const doc of verifications) {
          if (matches(doc, filter)) {
            applyUpdate(doc, update);
            count += 1;
          }
        }
        return { modifiedCount: count };
      }),
    } as unknown as Model<VerificationRecord>;

    oauthModel = {
      updateOne: vi.fn(async (filter: Doc, update: Doc) => {
        let doc = oauthAccounts.find((item) => matches(item, filter));
        if (!doc) {
          doc = { _id: new Types.ObjectId(), ...filter };
          oauthAccounts.push(doc);
        }
        applyUpdate(doc, update);
        return { modifiedCount: 1, upsertedCount: 1 };
      }),
    } as unknown as Model<{ userId: Types.ObjectId; provider: string; providerUserId: string }>;

    mail = new MailService();
    service = new AuthService(
      userModel,
      sessionModel,
      verificationModel,
      oauthModel,
      fakeConnection(),
      new TokenService(),
      mail
    );
  });

  it('signup, verify, login, refresh, detect reuse and logout', async () => {
    await service.signup({ email: 'Test@Example.com', password: 'correct-horse-battery', name: 'Test' });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('test@example.com');
    expect(users[0].passwordHash).not.toContain('correct-horse-battery');
    expect(verifications[0].tokenHash).toHaveLength(64);

    const verifyToken = mail.takeDevToken('test@example.com', 'verify');
    expect(verifyToken).toBeDefined();
    await service.verifyEmail(verifyToken!);
    expect(users[0].emailVerifiedAt).toBeInstanceOf(Date);

    const login = await service.login('test@example.com', 'correct-horse-battery', {
      userAgent: 'test-agent',
      ipHash: 'ip-hash',
    });
    expect(new TokenService().verifyAccess(login.accessToken).sub).toBe(users[0]._id.toString());
    expect(sessions[0].refreshTokenHash).not.toBe(login.refreshToken);
    expect(sessions[0].familyId).toBeDefined();
    expect(sessions[0].ipHash).toBe('ip-hash');

    const rotated = await service.refresh(login.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.refreshToken);
    expect(sessions[0].revokedAt).toBeInstanceOf(Date);
    expect(sessions[1].familyId).toBe(sessions[0].familyId);

    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions[1].revokedAt).toBeInstanceOf(Date);

    await expect(service.login('test@example.com', 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resets a password with a single-use hashed token and revokes sessions', async () => {
    await service.signup({ email: 'reset@example.com', password: 'old-password-long' });
    const verifyToken = mail.takeDevToken('reset@example.com', 'verify');
    await service.verifyEmail(verifyToken!);
    await service.login('reset@example.com', 'old-password-long');

    await service.requestPasswordReset('reset@example.com');
    const resetToken = mail.takeDevToken('reset@example.com', 'reset');
    expect(resetToken).toBeDefined();
    expect(verifications.find((token) => token.type === 'PASSWORD_RESET')?.tokenHash).not.toBe(resetToken);

    await service.confirmPasswordReset(resetToken!, 'new-password-long');
    expect(sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);
    await expect(service.confirmPasswordReset(resetToken!, 'another-password')).rejects.toThrow('Invalid or expired token');
    await expect(service.login('reset@example.com', 'old-password-long')).rejects.toBeInstanceOf(UnauthorizedException);

    const relogin = await service.login('reset@example.com', 'new-password-long');
    expect(relogin.accessToken).toBeTruthy();
    expect(await argon2.verify(users[0].passwordHash, 'new-password-long')).toBe(true);
  });

  it('links a Google identity by verified email and rejects unverified identities', async () => {
    await expect(
      service.googleSignIn({ sub: 'google-1', email: 'google@example.com', emailVerified: false })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const result = await service.googleSignIn({
      sub: 'google-1',
      email: 'Google@Example.com',
      name: 'Google User',
      emailVerified: true,
    });
    expect(users[0].email).toBe('google@example.com');
    expect(users[0].emailVerifiedAt).toBeInstanceOf(Date);
    expect(oauthAccounts[0].provider).toBe('google');
    expect(oauthAccounts[0].providerUserId).toBe('google-1');
    expect(result.user.id).toBe(users[0]._id.toString());
    expect(sessions).toHaveLength(1);
  });

  it('does not disclose whether an email exists during signup or reset', async () => {
    const existing = await service.signup({ email: 'known@example.com', password: 'password-long-enough' });
    const missing = await service.signup({ email: 'unknown@example.com', password: 'password-long-enough' });
    expect(existing.message).toBe(missing.message);

    const resetExisting = await service.requestPasswordReset('known@example.com');
    const resetMissing = await service.requestPasswordReset('nobody@example.com');
    expect(resetExisting.message).toBe(resetMissing.message);
    expect(users).toHaveLength(2);
  });
});
