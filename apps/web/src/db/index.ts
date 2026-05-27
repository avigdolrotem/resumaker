/**
 * Database client.
 *
 * Singleton pg client + drizzle-orm. Reads through the centralized
 * zod-validated env so a mistyped DATABASE_POOL_MAX surfaces at boot
 * instead of becoming NaN that postgres-js silently treats as default.
 *
 * Cloud SQL Connector is the only DB path. GCP_CLOUD_SQL_INSTANCE and
 * GCP_CLOUD_SQL_IAM_USER are required env vars (validated in env.ts).
 *
 * Module-load guarantee: if Cloud SQL is unreachable when this module
 * is first imported (which happens at Next.js `next build` when
 * collecting page data — no WIF creds in the build container), we fall
 * back to a stub client that throws on any query. Module load itself
 * never throws, so the build completes. At runtime in a GKE pod the
 * connect succeeds because Workload Identity provides creds.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { schema } from './schema';
import * as relations from './relations';

type PgClient = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __resumakerPgClient: PgClient | undefined;
}

async function makeClient(): Promise<PgClient> {
  // If DATABASE_URL is set, use it directly — simpler, no Connector
  // dance, works against any postgres reachable on the network. Pod
  // talks to Cloud SQL private IP through the VPC's Private Services
  // Access link.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgres://stub')) {
    return postgres(dbUrl, {
      max: env.DATABASE_POOL_MAX,
      ssl: 'require',
      // Cloud SQL idles out connections at ~10min; keep ours fresh so
      // we don't see "Connection terminated unexpectedly" mid-request.
      idle_timeout: 60,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
    });
  }
  // Otherwise fall back to the Cloud SQL Connector + IAM auth path.
  const { makeCloudSqlClient } = await import('./cloudsql');
  return makeCloudSqlClient({
    instance: env.GCP_CLOUD_SQL_INSTANCE,
    iamUser: env.GCP_CLOUD_SQL_IAM_USER,
    database: env.GCP_CLOUD_SQL_DATABASE ?? 'resumaker',
    poolMax: env.DATABASE_POOL_MAX,
    ipType: env.GCP_CLOUD_SQL_IP_TYPE,
  });
}

/**
 * Stub client used when the real connect fails at module load (build
 * time without WIF creds). postgres-js is lazy — instantiating with a
 * connection string doesn't actually open a TCP socket; only running a
 * query does. So this stub has the correct shape for drizzle init
 * (parsers, types, options) without ever touching the network.
 *
 * At build time (Next collecting page data), routes that touch the DB
 * load this module, drizzle initialises against the idle stub, and
 * nothing queries — build completes. At runtime in a GKE pod the real
 * connect succeeds and this branch never runs.
 */
function makeStubClient(): PgClient {
  return postgres('postgresql://stub:stub@127.0.0.1:5432/stub', {
    max: 1,
    connect_timeout: 1,
  });
}

const client =
  globalThis.__resumakerPgClient ??
  (await makeClient().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[db] Cloud SQL unreachable at module load — using stub client. Cause:', message);
    return makeStubClient();
  }));

if (process.env.NODE_ENV !== 'production') {
  globalThis.__resumakerPgClient = client;
}

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export { schema };
