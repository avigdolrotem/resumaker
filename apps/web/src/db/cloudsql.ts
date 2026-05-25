import { Connector, IpAddressTypes, AuthTypes } from '@google-cloud/cloud-sql-connector';
import postgres from 'postgres';

export interface CloudSqlClientArgs {
  instance: string;
  iamUser: string;
  database: string;
  poolMax?: number;
}

/**
 * Build a `postgres` client wired to Cloud SQL via the Connector.
 *
 * The Connector handles IAM auth (no static password), ephemeral SSL
 * certs, and DNS resolution. Caller passes the instance connection
 * name (`project:region:instance`) and the SA email used as the DB user.
 */
export async function makeCloudSqlClient(args: CloudSqlClientArgs) {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: args.instance,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });

  return postgres({
    ...clientOpts,
    database: args.database,
    user: args.iamUser,
    max: args.poolMax ?? 10,
  });
}
