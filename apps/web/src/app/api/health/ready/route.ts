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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DependencyStatus {
  status: 'ok' | 'down';
  latencyMs?: number;
  error?: string;
}

export async function GET(): Promise<Response> {
  const checks: Record<string, DependencyStatus> = {};

  // Postgres
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'down', error: (err as Error).message };
  }

  // Redis — non-blocking (if down, rate-limit fails open per design)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { createClient } = await import('redis');
      const redisStart = Date.now();
      const client = createClient({ url: redisUrl, socket: { connectTimeout: 1000 } });
      client.on('error', () => {
        /* swallow; we handle below */
      });
      await client.connect();
      await client.ping();
      await client.disconnect();
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch (err) {
      checks.redis = { status: 'down', error: (err as Error).message };
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
