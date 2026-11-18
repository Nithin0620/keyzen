import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import { randomToken } from '../common/tokens';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export class TokenService {
  signAccess(payload: AccessTokenPayload): string {
    const env = validateEnv();
    return jwt.sign(payload, env.AUTH_SECRET, {
      algorithm: 'HS256',
      expiresIn: env.AUTH_ACCESS_TTL,
    });
  }

  verifyAccess(token: string): AccessTokenPayload {
    const payload = jwt.verify(token, validateEnv().AUTH_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || !payload.email) {
      throw new Error('Invalid access token');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.emailVerified === true,
    };
  }

  newRefreshToken(): string {
    return randomToken(48);
  }

  newFamilyId(): string {
    return randomToken(16);
  }
}
