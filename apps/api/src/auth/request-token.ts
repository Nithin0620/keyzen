import type { Request } from 'express';
import { ACCESS_COOKIE, readCookie } from '../common/cookies';

export function accessTokenFromRequest(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : readCookie(req, ACCESS_COOKIE);
}
