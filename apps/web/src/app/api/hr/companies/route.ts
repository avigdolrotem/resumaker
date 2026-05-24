/**
 * GET  /api/hr/companies — list companies caller is member of
 * POST /api/hr/companies — create company (caller becomes owner)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';

async function requireHr(h: Headers) {
  const guard = await requireActiveUser(h);
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return guard;
}

export async function GET(): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const memberships = await db.query.companyMembers.findMany({
    where: eq(schema.companyMembers.userId, guard.user.id),
    with: { company: true },
  });

  const companies = memberships.map((m) => ({
    ...m.company,
    memberRole: m.role,
  }));

  return NextResponse.json({ companies });
}

const PostBody = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  websiteUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const existing = await db.query.companies.findFirst({
    where: eq(schema.companies.slug, body.slug),
  });
  if (existing) {
    return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
  }

  const [company] = await db
    .insert(schema.companies)
    .values({
      name: body.name,
      slug: body.slug,
      logoUrl: body.logoUrl ?? null,
      description: body.description ?? null,
      websiteUrl: body.websiteUrl ?? null,
      ownerUserId: guard.user.id,
    })
    .returning();

  if (!company) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  // Caller becomes owner member
  await db.insert(schema.companyMembers).values({
    companyId: company.id,
    userId: guard.user.id,
    role: 'owner',
    acceptedAt: new Date(),
  });

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_company_created', companyId: company.id, slug: body.slug },
  });

  return NextResponse.json({ id: company.id }, { status: 201 });
}
