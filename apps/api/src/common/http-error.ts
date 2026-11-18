export class HttpError extends Error {
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

type ErrorInput = string | Record<string, unknown>;

function split(input: ErrorInput | undefined, fallback: string): [string, Record<string, unknown> | undefined] {
  if (!input) {
    return [fallback, undefined];
  }
  if (typeof input === 'string') {
    return [input, undefined];
  }
  return [typeof input.message === 'string' ? input.message : fallback, input];
}

export class BadRequestException extends HttpError {
  constructor(input?: ErrorInput) {
    const [message, details] = split(input, 'Bad request');
    super(400, message, details);
  }
}

export class UnauthorizedException extends HttpError {
  constructor(input?: ErrorInput) {
    const [message, details] = split(input, 'Unauthorized');
    super(401, message, details);
  }
}

export class ForbiddenException extends HttpError {
  constructor(input?: ErrorInput) {
    const [message, details] = split(input, 'Forbidden');
    super(403, message, details);
  }
}

export class NotFoundException extends HttpError {
  constructor(input?: ErrorInput) {
    const [message, details] = split(input, 'Not found');
    super(404, message, details);
  }
}

export class ConflictException extends HttpError {
  constructor(input?: ErrorInput) {
    const [message, details] = split(input, 'Conflict');
    super(409, message, details);
  }
}

export class HttpException extends HttpError {
  constructor(input: ErrorInput, status: number) {
    const [message, details] = split(input, 'Http error');
    super(status, message, details);
  }
}

export enum HttpStatus {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  PAYLOAD_TOO_LARGE = 413,
  URI_TOO_LONG = 414,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}
