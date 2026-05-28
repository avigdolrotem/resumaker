/**
 * Rate limiter — atomic, fail-closed, fixed-window.
 *
 * Atomicity: uses a single Lua script that INCRs and sets EXPIRE only
 * on the first hit. The naive `INCR` + separate `EXPIRE` is racy under
 * concurrent bursts — many requests can see `current=1` simultaneously
 * and each set a fresh TTL, letting the bucket reset and bypass the
 * limit.
 *
 * Fail-closed: if Redis is unreachable, we block requests. Earlier
 * fail-open behavior left Better Auth signup/login/forgot-password
 * unprotected during Redis outages. Fail-closed makes failures visible
 * (users see 503) instead of silent (attackers exploit). REDIS_URL is
 * required in every environment — there is no dev escape hatch.
 *
 * The `vitest.setup.ts` test fixture stubs `process.env.REDIS_URL` so
 * unit tests can run without a real Redis; behavior matches prod
 * (returns 503 if the stub is removed).
 */

import { createClient } from 'redis';
import { logger } from '@/lib/observability';

type RedisClient = ReturnType<typeof createClient>;
type SocketOptions = NonNullable<NonNullable<Parameters<typeof createClient>[0]>['socket']>;

const globalForRedis = globalThis as unknown as {
  _redis?: RedisClient | null;
};

/**
 * Cap on how long we wait for a Redis connection. Memorystore is TLS-only
 * (rediss://, 6378) over a private VPC link; if that link is slow or degraded,
 * an unbounded connect() stalls the rate-limited request for many seconds
 * (observed ~25s hangs). We bound it and fail CLOSED fast — never open. Read
 * per call (not memoized) so it stays overridable in tests.
 */
function connectTimeoutMs(): number {
  return Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 2000;
}

function buildSocket(url: string): SocketOptions {
  const connectTimeout = connectTimeoutMs();
  // Plain TCP (local dev / non-TLS Redis).
  if (!url.startsWith('rediss://')) {
    return { connectTimeout };
  }
  // TLS link to Memorystore. Pin the server CA when provided (REDIS_CA_CERT);
  // otherwise skip cert verification. The endpoint is a private VPC IP using
  // SERVER_AUTHENTICATION, and node's default trust store does not include
  // Google's managed Memorystore CA — so without one of these, every TLS
  // handshake is rejected (UNABLE_TO_VERIFY_LEAF_SIGNATURE). CA pinning is the
  // hardened path; the private-link fallback is acceptable per the runbook.
  const ca = process.env.REDIS_CA_CERT;
  return ca
    ? { tls: true, ca, connectTimeout }
    : { tls: true, rejectUnauthorized: false, connectTimeout };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis connect timeout')), ms)),
  ]);
}

async function getClient(): Promise<RedisClient | null> {
  if (globalForRedis._redis) return globalForRedis._redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.error({}, 'rate-limit.redis_url_unset');
    return null;
  }
  let client: RedisClient | undefined;
  try {
    client = createClient({ url, socket: buildSocket(url) });
    client.on('error', (err: Error) => {
      logger.error({ err: err.message }, 'redis.error');
      // Drop the cached client so the next call rebuilds it once the network
      // path recovers, instead of reusing a dead socket forever.
      if (globalForRedis._redis === client) globalForRedis._redis = null;
    });
    // Bound the connect so a degraded private link can't hang the request.
    await withTimeout(client.connect(), connectTimeoutMs());
    globalForRedis._redis = client;
    return client;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'redis.connect_failed');
    // Best-effort cleanup so a stalled connect doesn't leak a reconnect loop.
    try {
      client?.destroy();
    } catch {
      /* socket already gone */
    }
    return null;
  }
}

/**
 * Lua script keeping INCR + first-EXPIRE atomic.
 * Returns [current_count, ttl_seconds].
 */
const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = -1
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
else
  ttl = redis.call('TTL', KEYS[1])
end
return { current, ttl }
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Check if a given key is under the limit, and increment if so.
 * Returns whether the request is allowed plus metadata for headers.
 *
 * Fails closed: if Redis is unreachable, returns `allowed: false`.
 * This is intentional — auth endpoints depend on rate limiting and
 * silent failure would expose them to abuse.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const fullKey = `rl:${key}`;
  const client = await getClient();

  if (!client) {
    // Redis unreachable — block the request rather than open the door.
    return { allowed: false, remaining: 0, resetSeconds: windowSeconds };
  }

  try {
    const result = (await client.eval(RATE_LIMIT_SCRIPT, {
      keys: [fullKey],
      arguments: [String(windowSeconds)],
    })) as [number, number];
    const [current, ttl] = result;
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (err) {
    logger.error(
      { err: (err as Error).message, key: fullKey },
      'rate-limit.script_failed_failing_closed',
    );
    return { allowed: false, remaining: 0, resetSeconds: windowSeconds };
  }
}
