/**
 * Database client.
 *
 * Singleton pg client + drizzle-orm. Reads through the centralized
 * zod-validated env so a mistyped DATABASE_POOL_MAX surfaces at boot
 * instead of becoming NaN that postgres-js silently treats as default.
 *
 * Cloud SQL Connector is the only DB path. GCP_CLOUD_SQL_INSTANCE and
 * GCP_CLOUD_SQL_IAM_USER are required env vars (validated in env.ts).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { schema } from './schema';
import * as relations from './relations';

declare global {
  // eslint-disable-next-line no-var
  var __resumakerPgClient: ReturnType<typeof postgres> | undefined;
}

async function makeClient() {
  const { makeCloudSqlClient } = await import('./cloudsql');
  return makeCloudSqlClient({
    instance: env.GCP_CLOUD_SQL_INSTANCE,
    iamUser: env.GCP_CLOUD_SQL_IAM_USER,
    database: env.GCP_CLOUD_SQL_DATABASE ?? 'resumaker',
    poolMax: env.DATABASE_POOL_MAX,
    ipType: env.GCP_CLOUD_SQL_IP_TYPE,
  });
}

const client = globalThis.__resumakerPgClient ?? (await makeClient());
if (process.env.NODE_ENV !== 'production') {
  globalThis.__resumakerPgClient = client;
}

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export { schema };
