import { Schema } from 'mongoose';

export const USER_MODEL = 'User';
export const OAUTH_ACCOUNT_MODEL = 'OAuthAccount';
export const SESSION_MODEL = 'Session';
export const VERIFICATION_TOKEN_MODEL = 'VerificationToken';

export const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 120 },
    passwordHash: { type: String, select: false },
    emailVerifiedAt: { type: Date, default: null },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', required: true },
  },
  { timestamps: true, strict: true }
);

export const OAuthAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true, index: true },
    provider: { type: String, required: true, enum: ['google'] },
    providerUserId: { type: String, required: true, trim: true },
  },
  { timestamps: true, strict: true }
);

OAuthAccountSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

export const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 500 },
    ipHash: { type: String, maxlength: 64 },
  },
  { timestamps: true, strict: true }
);

export const VerificationTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    type: { type: String, enum: ['EMAIL_VERIFY', 'PASSWORD_RESET'], required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);
