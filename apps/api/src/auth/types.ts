import type { Types } from 'mongoose';

export interface UserRecord {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  passwordHash?: string;
  emailVerifiedAt: Date | null;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface SessionRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface VerificationRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  type: 'EMAIL_VERIFY' | 'PASSWORD_RESET';
  expiresAt: Date;
  usedAt: Date | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionMetadata {
  userAgent?: string;
  ipHash?: string;
}

export interface Profile {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}
