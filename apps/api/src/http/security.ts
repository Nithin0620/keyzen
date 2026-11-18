import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpException } from '../common/http-error';

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const id = randomUUID();
    (req as typeof req & { requestId?: string }).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

export function enforceTls(enabled: boolean): RequestHandler {
  return (req, _res, next) => {
    if (enabled && !req.secure) {
      next(new HttpException('HTTPS required', 403));
      return;
    }
    next();
  };
}

export function limitUrl(maxLength: number): RequestHandler {
  return (req, _res, next) => {
    if (req.originalUrl.length > maxLength) {
      next(new HttpException('URI too long', 414));
      return;
    }
    next();
  };
}
