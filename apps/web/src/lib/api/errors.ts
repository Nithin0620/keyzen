export interface ApiFieldErrors {
  [field: string]: string | string[];
}

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: number;
}

export interface ApiErrorInit {
  status: number;
  message: string;
  code?: string;
  fields?: ApiFieldErrors;
  requestId?: string | null;
  rateLimit?: RateLimitInfo;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: ApiFieldErrors;
  readonly requestId?: string | null;
  readonly rateLimit: RateLimitInfo;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.requestId = init.requestId;
    this.rateLimit = init.rateLimit ?? {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toApiFieldErrors(value: unknown): ApiFieldErrors | undefined {
  if (!isRecord(value)) return undefined;

  const fields: ApiFieldErrors = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      fields[key] = entry;
      continue;
    }
    if (Array.isArray(entry) && entry.every((item) => typeof item === 'string')) {
      fields[key] = entry;
    }
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
}
