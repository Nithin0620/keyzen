import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { validateEnv } from '../config/env';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

@Injectable()
export class GoogleService {
  private client(): OAuth2Client {
    const env = validateEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
  }

  authorizationUrl(): string {
    return this.client().generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
    });
  }

  async verifyCode(code: string): Promise<GoogleIdentity> {
    const client = this.client();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new UnauthorizedException();
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: validateEnv().GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException();
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
      emailVerified: true,
    };
  }
}
