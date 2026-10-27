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

const client =
  global._postgresClient ??
  postgres(connectionString, {
    prepare: false, // Required for Supabase transaction pooler
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  global._postgresClient = client;
}

export const db =
  global._drizzleDb ??
  drizzle(client, { schema });

if (process.env.NODE_ENV !== 'production') {
  global._drizzleDb = db;
}

export * from './schema';
