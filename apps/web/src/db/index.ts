/**
 * Database client.
 *
 * Singleton pg client + drizzle-orm.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// In dev, hot reload would create many connections — cache on globalThis
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };

const client =
  globalForDb._pg ??
  postgres(connectionString, {
    max: parseInt(process.env.DATABASE_POOL_MAX ?? '20', 10),
    idle_timeout: 30,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb._pg = client;
}

export const db = drizzle(client, { schema });
export { schema };
