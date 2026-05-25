/**
 * Database client.
 *
 * Singleton pg client + drizzle-orm. Reads through the centralized
 * zod-validated env so a mistyped DATABASE_POOL_MAX surfaces at boot
 * instead of becoming NaN that postgres-js silently treats as default.
 *
 * When GCP_CLOUD_SQL_INSTANCE + GCP_CLOUD_SQL_IAM_USER are set the
 * Cloud SQL Connector path is used (IAM auth, ephemeral TLS certs).
 * Otherwise falls back to the raw DATABASE_URL (Neon / local).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { schema } from './schema';
import * as relations from './relations';

type PgClient = ReturnType<typeof postgres>;

// Cache on globalThis so test isolation + hot reload don't leak connections.
const globalForDb = globalThis as unknown as { _pg?: PgClient };

async function makeClient(): Promise<PgClient> {
  if (env.GCP_CLOUD_SQL_INSTANCE && env.GCP_CLOUD_SQL_IAM_USER) {
    const { makeCloudSqlClient } = await import('./cloudsql');
    return makeCloudSqlClient({
      instance: env.GCP_CLOUD_SQL_INSTANCE,
      iamUser: env.GCP_CLOUD_SQL_IAM_USER,
      database: env.GCP_CLOUD_SQL_DATABASE ?? 'resumaker',
      poolMax: env.DATABASE_POOL_MAX,
    });
  }
  return postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

const client: PgClient = globalForDb._pg ?? (await makeClient());

if (env.NODE_ENV !== 'production') {
  globalForDb._pg = client;
}

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export { schema };
