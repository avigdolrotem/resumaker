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
  // 1s connectTimeout, 1.5s overall race so a TLS-handshake stall on
  // Memorystore can't tie up the probe past its timeout.
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisStart = Date.now();
    try {
      const { createClient } = await import('redis');
      // Memorystore is TLS-only (rediss://) with a Google-managed CA not in
      // node's default trust store. Mirror rate-limit.ts: pin REDIS_CA_CERT
      // when provided, else skip verification on the private VPC link — without
      // this the handshake fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE and this
      // probe reports redis:down even when Redis is reachable.
      const useTls = redisUrl.startsWith('rediss://');
      const ca = process.env.REDIS_CA_CERT;
      const socket = useTls
        ? ca
          ? { connectTimeout: 1000, tls: true as const, ca }
          : { connectTimeout: 1000, tls: true as const, rejectUnauthorized: false }
        : { connectTimeout: 1000 };
      const client = createClient({ url: redisUrl, socket });
      client.on('error', () => {
        /* swallow; we handle below */
      });
      await Promise.race([
        (async () => {
          await client.connect();
          await client.ping();
          await client.disconnect();
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('redis timeout (1.5s)')), 1500),
        ),
      ]);
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'health.ready: redis check failed');
      checks.redis = { status: 'down' };
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
