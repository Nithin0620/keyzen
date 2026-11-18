import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequestException } from './http-error';

export type ValidationSource = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: ValidationSource = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new BadRequestException({
          message: 'Invalid input',
          fields: result.error.flatten().fieldErrors,
        })
      );
      return;
    }
    (req as any)[source] = result.data;
    next();
  };
}
