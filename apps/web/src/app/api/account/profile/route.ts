/**
 * GET   /api/account/profile — read current profile (cover-letter builder
 *                              needs name + skills to personalize letters
 *                              instead of producing generic JD-only text)
 * PATCH /api/account/profile — update name / locale preference
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: {
      id: true,
      email: true,
      name: true,
      locale: true,
      emailVerified: true,
      createdAt: true,
      // These four round-trip through PATCH /api/account/preferences.
      // Without them here, every tab that reads them (Notifications,
      // Date & time) shows a save as successful, then silently reverts
      // to the default on the next load/reload — the value was always
      // persisted correctly, this endpoint just never sent it back.
      marketingOptIn: true,
      notificationPrefs: true,
      timezone: true,
      dateFormat: true,
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Pull the user's most recent resume — its `content` is the closest
  // approximation we have of a "profile" right now (until a dedicated
  // user_profile table lands with the L5 job-hunt port). Letter
  // generation uses name + skills + summary from this.
  const recent = await db.query.resumes.findFirst({
    where: and(eq(schema.resumes.userId, session.user.id), isNull(schema.resumes.deletedAt)),
    orderBy: (r, { desc }) => [desc(r.updatedAt)],
    columns: { content: true },
  });
  const profileFromResume: Record<string, unknown> =
    recent?.content && typeof recent.content === 'object'
      ? extractProfileFields(recent.content as Record<string, unknown>)
      : {};

  return NextResponse.json({
    user,
    profile: {
      name: user.name ?? '',
      email: user.email,
      ...profileFromResume,
    },
  });
}

/** Pull the contact + skills fields out of a resume.content JSON blob. */
function extractProfileFields(content: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const contact =
    content['contact'] && typeof content['contact'] === 'object'
      ? (content['contact'] as Record<string, unknown>)
      : {};
  if (contact['phone']) out['phone'] = contact['phone'];
  if (contact['location']) out['location'] = contact['location'];
  if (contact['linkedin']) out['linkedin'] = contact['linkedin'];
  if (typeof content['summary'] === 'string') out['summary'] = content['summary'];
  if (Array.isArray(content['skills'])) out['skills'] = content['skills'];
  if (Array.isArray(content['experience'])) out['experience'] = content['experience'];
  return out;
}

const BodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  locale: z.enum(['he', 'en']).optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  if (!body.name && !body.locale) {
    return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
  }

  await db
    .update(schema.users)
    .set({
      ...(body.name ? { name: body.name } : {}),
      ...(body.locale ? { locale: body.locale } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, session.user.id));

  auditEvent({
    userId: session.user.id,
    event: 'profile_updated',
    metadata: { fields: Object.keys(body) },
  });

  return NextResponse.json({ success: true });
}
