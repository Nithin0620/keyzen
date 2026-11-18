import type { RequestHandler } from 'express';
import { z, type RefinementCtx } from 'zod';
import { BadRequestException } from './http-error';

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;
const MAX_KEYS = 200;

function issue(ctx: RefinementCtx, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}

function walk(value: unknown, depth: number, ctx: RefinementCtx): void {
  if (depth > MAX_DEPTH) {
    issue(ctx, 'Input is too deeply nested');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      issue(ctx, 'Input contains an invalid number');
    }
    return;
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'undefined') {
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_KEYS) {
      issue(ctx, 'Input array is too large');
      return;
    }
    for (const entry of value) {
      walk(entry, depth + 1, ctx);
    }
    return;
  }
  if (typeof value !== 'object') {
    issue(ctx, 'Input contains an unsupported value');
    return;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_KEYS) {
    issue(ctx, 'Input object has too many keys');
    return;
  }
  for (const [key, entry] of entries) {
    if (!key || key.length > 200 || key.includes('.') || key.startsWith('$') || BLOCKED_KEYS.has(key)) {
      issue(ctx, 'Input contains an unsafe key');
    }
    walk(entry, depth + 1, ctx);
  }
}

const inputSchema = z.any().superRefine((value, ctx) => {
  walk(value, 0, ctx);
});

export function globalValidation(): RequestHandler {
  return (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      next();
      return;
    }
    const result = inputSchema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      next(new BadRequestException({ message: 'Invalid input' }));
      return;
    }
    next();
  };
}
