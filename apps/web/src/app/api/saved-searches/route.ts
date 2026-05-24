/**
 * GET    /api/saved-searches — list current user's saved job searches
 * POST   /api/saved-searches — create
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

export async function GET(): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db.query.savedSearches.findMany({
    where: eq(schema.savedSearches.userId, guard.user.id),
    orderBy: [desc(schema.savedSearches.createdAt)],
  });
  return NextResponse.json({ searches: rows });
}

const Post = z.object({
  name: z.string().min(1).max(100),
  query: z.object({
    q: z.string().max(120).optional(),
    company: z.string().max(120).optional(),
    source: z.string().max(40).optional(),
    remote: z.boolean().optional(),
  }),
  alertFrequency: z.enum(['daily', 'weekly', 'off']).default('daily'),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof Post>;
  try {
    body = Post.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Strip undefined keys so the jsonb $type (which expects optional but
  // not-undefined per exactOptionalPropertyTypes) accepts the value.
  const queryClean: Record<string, unknown> = {};
  if (body.query.q !== undefined) queryClean['q'] = body.query.q;
  if (body.query.company !== undefined) queryClean['company'] = body.query.company;
  if (body.query.source !== undefined) queryClean['source'] = body.query.source;
  if (body.query.remote !== undefined) queryClean['remote'] = body.query.remote;

  const [row] = await db
    .insert(schema.savedSearches)
    .values({
      userId: guard.user.id,
      name: body.name,
      query: queryClean as { q?: string; company?: string; source?: string; remote?: boolean },
      alertFrequency: body.alertFrequency,
    })
    .returning({ id: schema.savedSearches.id });

  return NextResponse.json({ id: row?.id });
}
