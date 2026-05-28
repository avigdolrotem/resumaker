/**
 * One-shot Redis health probe for the readiness endpoint.
 *
 * CRITICAL — the client is destroyed in `finally` on every path. If a connect
 * loses the timeout race it is otherwise orphaned and keeps retrying in the
 * background (node-redis default reconnect), leaking a socket on every probe
 * (every 5s). Under a degraded Redis link those orphans accumulate until the
 * pod holds hundreds of reconnecting clients and burns CPU with zero real
 * traffic — which pegged the HPA at max replicas (the "money leak": observed
 * 512 leaked sockets / 558m CPU on an idle prod pod). Always tear down.
 */
import { createClient } from 'redis';

export interface RedisHealth {
  status: 'ok' | 'down';
  latencyMs?: number;
}

type SocketOptions = NonNullable<NonNullable<Parameters<typeof createClient>[0]>['socket']>;

function buildSocket(url: string, connectTimeout: number): SocketOptions {
  if (!url.startsWith('rediss://')) return { connectTimeout };
  // Memorystore is TLS-only with a Google-managed CA not in node's default
  // trust store. Pin REDIS_CA_CERT when provided, else skip verification on the
  // private VPC link (otherwise every handshake fails UNABLE_TO_VERIFY_LEAF...).
  const ca = process.env.REDIS_CA_CERT;
  return ca
    ? { tls: true, ca, connectTimeout }
    : { tls: true, rejectUnauthorized: false, connectTimeout };
}

export async function checkRedis(url: string, timeoutMs = 1500): Promise<RedisHealth> {
  const start = Date.now();
  const client = createClient({ url, socket: buildSocket(url, Math.min(1000, timeoutMs)) });
  // Swallow async client errors; the race/return below is the source of truth.
  client.on('error', () => {});
  try {
    await Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`redis timeout (${timeoutMs}ms)`)), timeoutMs),
      ),
    ]);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'down' };
  } finally {
    // ALWAYS tear down — see file header. destroy() is synchronous and safe
    // even if connect() never completed.
    try {
      client.destroy();
    } catch {
      /* socket already gone */
    }
  }
}
