/**
 * GET /api/health — liveness probe
 *
 * Returns 200 if the process is alive. Does NOT check dependencies.
 * For readiness (with DB/Redis pings), see /api/health/ready.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'resumaker',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
