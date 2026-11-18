import type { RequestHandler } from 'express';
import { ForbiddenException } from '../common/http-error';

export function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

export function createCors(origins: string[]): RequestHandler {
  const allowed = new Set(origins.map(normalizeOrigin));
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }
    res.setHeader('Vary', 'Origin');
    if (!allowed.has(origin)) {
      next(new ForbiddenException());
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
