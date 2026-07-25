/**
 * PATCH /api/user/dashboard-prefs
 * body: { onboardingChecklistDismissed?: true } | { profileNudgeSnoozedUntil: string | null }
 *
 * Small, permanent (server-persisted, survives login/device) dashboard
 * dismiss preferences — stored in users.featureFlags alongside
 * jobHuntBeta rather than a new table, same pattern, same column.
 *
 * The *other* half of each dismissal — "just for now" on the onboarding
 * checklist — is intentionally NOT here: that's sessionStorage,
 * client-only, resets next session. Only the permanent choice needs a
 * server round-trip.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

const PatchSchema = z
  .object({
    onboardingChecklistDismissed: z.literal(true).optional(),
    profileNudgeSnoozedUntil: z.string().datetime().nullable().optional(),
  })
  .refine(
    (d) => d.onboardingChecklistDismissed !== undefined || d.profileNudgeSnoozedUntil !== undefined,
    { message: 'Provide onboardingChecklistDismissed or profileNudgeSnoozedUntil' },
  );

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { featureFlags: true },
  });

  const nextFlags = {
    ...existing?.featureFlags,
    ...(body.onboardingChecklistDismissed !== undefined && {
      onboardingChecklistDismissed: body.onboardingChecklistDismissed,
    }),
    ...(body.profileNudgeSnoozedUntil !== undefined && {
      profileNudgeSnoozedUntil: body.profileNudgeSnoozedUntil ?? undefined,
    }),
  };

  await db
    .update(schema.users)
    .set({ featureFlags: nextFlags })
    .where(eq(schema.users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
