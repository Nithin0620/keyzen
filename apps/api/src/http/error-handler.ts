import type { ErrorRequestHandler, Request, Response } from 'express';
import { HttpError } from '../common/http-error';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: (error?: unknown) => void
): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.details ?? { message: error.message, statusCode: error.status });
    return;
  }
  res.status(500).json({ message: 'Internal server error' });
};
