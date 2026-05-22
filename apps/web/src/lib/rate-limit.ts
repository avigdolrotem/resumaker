/**
 * Simple Redis-based rate limiter using fixed window.
 *
 * For production we'd want sliding window or token bucket,
 * but fixed window is fine for v1.
 */

import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as { _redis?: RedisClient };

async function getClient(): Promise<RedisClient> {
  if (globalForRedis._redis) return globalForRedis._redis;
  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err: Error) => console.error('[redis] error:', err));
  await client.connect();
  globalForRedis._redis = client;
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Check if a given key is under the limit, and increment if so.
 * Returns whether the request is allowed plus metadata for headers.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const client = await getClient();
    const fullKey = `rl:${key}`;

    const current = await client.incr(fullKey);
    if (current === 1) {
      await client.expire(fullKey, windowSeconds);
    }

    const ttl = await client.ttl(fullKey);
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetSeconds: ttl,
    };
  } catch (err) {
    // Fail open: if Redis is down, don't block users
    console.error('[rate-limit] error, failing open:', err);
    return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  }
}
