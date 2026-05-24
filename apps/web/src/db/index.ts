/**
 * Database client.
 *
 * Singleton pg client + drizzle-orm. Reads through the centralized
 * zod-validated env so a mistyped DATABASE_POOL_MAX surfaces at boot
 * instead of becoming NaN that postgres-js silently treats as default.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { schema } from './schema';
import * as relations from './relations';

// Cache on globalThis so test isolation + hot reload don't leak connections.
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };

const client =
  globalForDb._pg ??
  postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    idle_timeout: 30,
    connect_timeout: 10,
  });

if (env.NODE_ENV !== 'production') {
  globalForDb._pg = client;
}

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export { schema };
