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
    KEYZEN_MASTER_KEY: z.string().min(32).optional(),
    KEYZEN_KMS_KEY_ID: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.KEYZEN_MASTER_KEY && !env.KEYZEN_KMS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'KEYZEN_MASTER_KEY or KEYZEN_KMS_KEY_ID is required in production',
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
