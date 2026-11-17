import type { Request, Response } from 'express';

export const ACCESS_COOKIE = 'aegis_access';
export const REFRESH_COOKIE = 'aegis_refresh';

const ACCESS_MAX_AGE = 15 * 60 * 1000;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return undefined;
}

function options(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, secure: boolean): void {
  res.cookie(ACCESS_COOKIE, accessToken, options(secure, ACCESS_MAX_AGE));
  res.cookie(REFRESH_COOKIE, refreshToken, options(secure, REFRESH_MAX_AGE));
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.cookie(ACCESS_COOKIE, '', options(secure, 0));
  res.cookie(REFRESH_COOKIE, '', options(secure, 0));
}
