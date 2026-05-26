import { Connector, IpAddressTypes, AuthTypes } from '@google-cloud/cloud-sql-connector';
import postgres from 'postgres';

export interface CloudSqlClientArgs {
  instance: string;
  iamUser: string;
  database: string;
  poolMax?: number;
  /**
   * IP type used by the Cloud SQL Connector.
   *
   * - `'PRIVATE'` (default) — GKE pods reach Cloud SQL via private IP over
   *   VPC peering. No public IPv4 endpoint required on the instance.
   * - `'PUBLIC'`  — required when connecting from outside the VPC, e.g.
   *   Vercel preview deployments or a developer's laptop.
   *
   * Controlled by `GCP_CLOUD_SQL_IP_TYPE` env var; defaults to `PRIVATE`
   * so GKE production is zero-config.
   */
  ipType?: 'PUBLIC' | 'PRIVATE';
}

// Module-scope so it survives across calls; SIGTERM handler closes it on shutdown.
let connector: Connector | null = null;

function getConnector(): Connector {
  if (!connector) {
    connector = new Connector();
    const close = () => {
      connector?.close();
      connector = null;
    };
    process.once('SIGTERM', close);
    process.once('SIGINT', close);
  }
  return connector;
}

/**
 * Build a `postgres` client wired to Cloud SQL via the Connector.
 *
 * The Connector handles IAM auth (no static password), ephemeral SSL
 * certs, and DNS resolution. Caller passes the instance connection
 * name (`project:region:instance`) and the SA email used as the DB user.
 *
 * The Connector is kept at module scope and reused across calls. It is
 * closed on SIGTERM/SIGINT so OS file descriptors are freed on shutdown.
 */
export async function makeCloudSqlClient(args: CloudSqlClientArgs) {
  const c = getConnector();
  const ipType = args.ipType === 'PUBLIC' ? IpAddressTypes.PUBLIC : IpAddressTypes.PRIVATE;
  const clientOpts = await c.getOptions({
    instanceConnectionName: args.instance,
    ipType,
    authType: AuthTypes.IAM,
  });

  return postgres({
    ...clientOpts,
    database: args.database,
    user: args.iamUser,
    max: args.poolMax ?? 10,
  });
}
