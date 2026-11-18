import type { ErrorRequestHandler, Request } from 'express';
import { redactSensitive, redactText } from '../common/redact';
import { HttpError, HttpException, HttpStatus } from '../common/http-error';
import { logger } from '../logging/logger';
import { captureException } from '../observability/errors';

const SAFE_DETAIL_KEYS = new Set(['message', 'statusCode', 'fields', 'code', 'retryable']);
const SENSITIVE_DETAIL_KEY = /(value|values|password|passwd|token|secret|authorization|cookie|cipher|authTag|key|credentials?|apiKey)/i;
const SECRET_PATTERN = /(ags_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|[A-Za-z0-9+/]{40,}={0,2})/g;
const MAX_DETAIL_DEPTH = 5;

type BodyParserError = Error & { type?: string };

function safeText(value: string): string {
  return value.slice(0, 500).replace(SECRET_PATTERN, '[REDACTED]');
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DETAIL_DEPTH) {
    return '[REDACTED]';
  }
  if (typeof value === 'string') {
    return safeText(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_DETAIL_KEY.test(key) ? '[REDACTED]' : sanitizeValue(entry, depth + 1);
    }
    return result;
  }
  return '[REDACTED]';
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (key === 'fields') {
      result[key] = sanitizeValue(value);
    } else if (SAFE_DETAIL_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value)) {
      result[key] = typeof value === 'string' ? safeText(value) : value;
    } else {
      result[key] = '[REDACTED]';
    }
  }
  return result;
}

function requestId(req: Request): string {
  return (req as Request & { requestId?: string }).requestId ?? 'unknown';
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res,
  _next
): void => {
  const id = requestId(req);
  res.setHeader('X-Request-Id', id);

  if (error instanceof HttpError) {
    if (error.status === HttpStatus.TOO_MANY_REQUESTS && !res.hasHeader('Retry-After')) {
      res.setHeader('Retry-After', '60');
    }
    const details = error.details
      ? sanitizeDetails(error.details)
      : { message: safeText(redactText(error.message)), statusCode: error.status };
    logger.warn(
      redactSensitive({ requestId: id, method: req.method, path: req.path, status: error.status }),
      'request rejected'
    );
    res.status(error.status).json(details);
    return;
  }

  const bodyError = error as BodyParserError;
  if (bodyError instanceof Error && bodyError.type === 'entity.too.large') {
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({ message: 'Payload too large', statusCode: 413 });
    return;
  }
  if (bodyError instanceof Error && bodyError.type === 'entity.parse.failed') {
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid JSON', statusCode: 400 });
    return;
  }

  const context = {
    requestId: id,
    method: req.method,
    path: req.path,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    error: error instanceof Error ? safeText(error.message) : 'Unknown error',
  };
  logger.error(redactSensitive(context), 'request failed');
  captureException(error, context);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
};

export function tooManyRequests(): HttpException {
  return new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
}
