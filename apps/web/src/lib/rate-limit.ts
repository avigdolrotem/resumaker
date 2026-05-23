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

const globalForRedis = globalThis as unknown as {
  _redis?: RedisClient | null;
};

async function getClient(): Promise<RedisClient | null> {
  if (globalForRedis._redis) return globalForRedis._redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.error({}, 'rate-limit.redis_url_unset');
    return null;
  }
  try {
    const client = createClient({ url });
    client.on('error', (err: Error) => logger.error({ err: err.message }, 'redis.error'));
    await client.connect();
    globalForRedis._redis = client;
    return client;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'redis.connect_failed');
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
