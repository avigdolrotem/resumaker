/**
 * GET /api/health/ready — readiness probe
 *
 * Returns 200 only if the service can actually serve traffic:
 *  - Postgres is reachable
 *  - Redis is reachable (best-effort)
 *
 * Used by k8s readiness probes and load balancer health checks.
 */

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { logger } from '@/lib/observability';
import { checkRedis } from '@/lib/redis-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DependencyStatus {
  status: 'ok' | 'down';
  latencyMs?: number;
}

export async function GET(): Promise<Response> {
  const checks: Record<string, DependencyStatus> = {};

  // Postgres — wrap in a hard 2s timeout so a stuck pool doesn't
  // make the readiness probe hang the entire LB health check (which
  // previously caused /api/health/ready to time out at 15s without
  // ever logging a real failure cause).
  const dbStart = Date.now();
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error('db timeout (2s)')), 2000)),
    ]);
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'health.ready: database check failed');
    checks.database = { status: 'down' };
  }

  // Redis — non-blocking (if down, rate-limit fails closed per design).
  // checkRedis ALWAYS tears the client down (even on timeout) so a degraded
  // Memorystore link can't leak a reconnecting socket on every 5s probe — that
  // leak accumulated hundreds of clients/pod and pegged the HPA (the money leak).
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    checks.redis = await checkRedis(redisUrl, 1500);
    if (checks.redis.status === 'down') {
      logger.error({}, 'health.ready: redis check failed');
    }
  }

  const allCritical = checks.database?.status === 'ok';
  const httpStatus = allCritical ? 200 : 503;

  return NextResponse.json(
    {
      status: allCritical ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
