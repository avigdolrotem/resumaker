/**
 * Rate limiter — atomic, fail-closed, fixed-window.
 *
 * Atomicity: uses a single Lua script that INCRs and sets EXPIRE only
 * on the first hit. The naive `INCR` + separate `EXPIRE` is racy under
 * concurrent bursts — many requests can see `current=1` simultaneously
 * and each set a fresh TTL, letting the bucket reset and bypass the
 * limit.
 *
 * Fail-closed: if Redis is unreachable, we DO block requests. Earlier
 * fail-open behavior turned the limiter into a no-op during Redis
 * outages, leaving Better Auth signup/login/forgot-password totally
 * unprotected. Fail-closed makes the failure mode visible (users see
 * 503) instead of silent (attackers exploit).
 *
 * In environments without Redis (local dev, CI), set `REDIS_URL=disabled`
 * to skip the connection attempt and use an in-memory fallback (safe
 * because dev/CI traffic is single-process).
 */

import { createClient } from 'redis';
import { logger } from '@/lib/observability';

type RedisClient = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as {
  _redis?: RedisClient | null;
  _redisDisabled?: boolean;
  _memoryBucket?: Map<string, { count: number; resetAt: number }>;
};

const REDIS_DISABLED_FLAG = 'disabled';

async function getClient(): Promise<RedisClient | null> {
  if (globalForRedis._redisDisabled) return null;
  if (globalForRedis._redis) return globalForRedis._redis;
  const url = process.env.REDIS_URL;
  if (!url || url === REDIS_DISABLED_FLAG) {
    globalForRedis._redisDisabled = true;
    if (process.env.NODE_ENV !== 'test') {
      logger.warn({}, 'rate-limit.redis_disabled_using_memory_fallback');
    }
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
 * If Redis is unreachable AND `REDIS_URL=disabled`, uses an in-memory
 * Map (safe for single-process dev/CI). Otherwise blocks the request
 * to make the failure visible.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const fullKey = `rl:${key}`;
  const client = await getClient();

  if (client) {
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
      // Fail closed when Redis errors mid-request — protects auth endpoints
      return { allowed: false, remaining: 0, resetSeconds: windowSeconds };
    }
  }

  // In-memory fallback (only when REDIS_URL=disabled — i.e. dev/test)
  return memoryFallback(fullKey, limit, windowSeconds);
}

function memoryFallback(fullKey: string, limit: number, windowSeconds: number): RateLimitResult {
  const bucket = (globalForRedis._memoryBucket ??= new Map());
  const now = Date.now();
  const entry = bucket.get(fullKey);
  if (!entry || entry.resetAt < now) {
    bucket.set(fullKey, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
  }
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { allowed: entry.count <= limit, remaining, resetSeconds };
}
