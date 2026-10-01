import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/keyzen'),
  KEYZEN_MASTER_KEY: z.string().default('keyzen_dev_master_key_must_be_32_bytes_or_more_secure!'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  /**
   * Must match NEXTAUTH_SECRET from the Workflow project.
   * Used to verify JWT tokens issued by Workflow's /api/v1/auth/login.
   */
  WORKFLOW_AUTH_SECRET: z.string().default(''),
});

export const config = envSchema.parse(process.env);
