import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDatabaseClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/keyzen';
  
  // Create postgres client optimized for Supabase transaction pooler or direct connection
  const client = postgres(url, {
    prepare: false, // Required for Supabase transaction pooler (port 6543)
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabaseClient>;
