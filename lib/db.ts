import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/keyzen';

declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var _drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export const sql =
  global._postgresClient ??
  postgres(connectionString, {
    prepare: false, // Required for Supabase transaction pooler
    max: 10,
    idle_timeout: 300, // Keep connection hot for 5 minutes instead of dropping after 20s
    connect_timeout: 10,
    max_lifetime: 1800,
  });

if (process.env.NODE_ENV !== 'production') {
  global._postgresClient = sql;
}

export const db =
  global._drizzleDb ??
  drizzle(sql, { schema });

if (process.env.NODE_ENV !== 'production') {
  global._drizzleDb = db;
}

export * from './schema';
