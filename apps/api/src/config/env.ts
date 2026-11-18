import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    MONGODB_URI: z.string().startsWith('mongodb://').or(z.string().startsWith('mongodb+srv://')),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    AUTH_SECRET: z.string().min(32),
    AUTH_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    AUTH_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
    SERVICE_TOKEN_RATE_LIMIT: z.coerce.number().int().positive().default(60),
    SERVICE_TOKEN_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    AEGIS_MASTER_KEY: z.string().min(32).optional(),
    AEGIS_KMS_KEY_ID: z.string().optional(),
    AWS_REGION: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(1).default('Aegis <no-reply@example.com>'),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PRO: z.string().optional(),
    STRIPE_PRICE_ENTERPRISE: z.string().optional(),
    WEBHOOK_SECRET_ENCRYPTION_KEY: z.string().min(32).optional(),
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    OPS_ALERT_EMAIL: z.string().email().optional(),
    JOB_TOKEN_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
    JOB_KEY_ROTATION_INTERVAL_MS: z.coerce.number().int().positive().default(86_400_000),
    JOB_AUDIT_RETENTION_INTERVAL_MS: z.coerce.number().int().positive().default(86_400_000),
    JOB_INVITATION_CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000),
    JOB_WEBHOOK_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
    JOB_KEY_ROTATION_TARGET_ID: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.AEGIS_MASTER_KEY && !env.AEGIS_KMS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AEGIS_MASTER_KEY or AEGIS_KMS_KEY_ID is required in production',
      });
    }
    if (env.AEGIS_KMS_KEY_ID && !env.AWS_REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AWS_REGION is required when AEGIS_KMS_KEY_ID is set',
      });
    }
    if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RESEND_API_KEY is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.OPS_ALERT_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPS_ALERT_EMAIL is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.WEBHOOK_SECRET_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WEBHOOK_SECRET_ENCRYPTION_KEY is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STRIPE_SECRET_KEY is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STRIPE_WEBHOOK_SECRET is required in production',
      });
    }
    if (env.NODE_ENV === 'production' && (!env.STRIPE_PRICE_PRO || !env.STRIPE_PRICE_ENTERPRISE)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STRIPE_PRICE_PRO and STRIPE_PRICE_ENTERPRISE are required in production',
      });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function validateEnv(input: NodeJS.ProcessEnv = process.env): Env {
  if (!cached) {
    cached = schema.parse(input);
  }
  return cached;
}
