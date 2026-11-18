import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';

export function createLogger(destination?: NodeJS.WritableStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body',
          'req.query',
          'value',
          'password',
          'token',
          'secret',
          'apiKey',
          'authorization',
          'signingSecret',
          'wrappedDek',
          'ciphertext',
          'authTag',
          '*.value',
          '*.password',
          '*.token',
          '*.secret',
          '*.apiKey',
          '*.authorization',
          '*.signingSecret',
          '*.wrappedDek',
          '*.ciphertext',
          '*.authTag',
          '*.*.value',
          '*.*.password',
          '*.*.token',
          '*.*.secret',
          '*.*.apiKey',
          '*.*.authorization',
          '*.*.signingSecret',
          '*.*.wrappedDek',
          '*.*.ciphertext',
          '*.*.authTag',
        ],
        censor: '[REDACTED]',
      },
    },
    destination
  );
}

export const logger = createLogger();

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId: (req as Request & { requestId?: string }).requestId ?? 'unknown',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'request completed'
    );
  });
  next();
}
