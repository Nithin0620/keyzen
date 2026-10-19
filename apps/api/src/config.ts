import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEV_MASTER_KEY = 'keyzen_dev_master_key_must_be_32_bytes_or_more_secure!';

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/keyzen'),
    KEYZEN_MASTER_KEY: z.string().min(32).default(DEV_MASTER_KEY),
    CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
    /**
     * Must match NEXTAUTH_SECRET from the Workflow project.
     * Used to verify JWT tokens issued by Workflow's /api/v1/auth/login.
     */
    WORKFLOW_AUTH_SECRET: z.string().default(''),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        return data.KEYZEN_MASTER_KEY !== DEV_MASTER_KEY;
      }
      return true;
    },
    {
      message:
        'KEYZEN_MASTER_KEY cannot use the default dev key in production. Please set a strong, unique 32+ byte master key.',
      path: ['KEYZEN_MASTER_KEY'],
    }
  );

export const config = envSchema.parse(process.env);
