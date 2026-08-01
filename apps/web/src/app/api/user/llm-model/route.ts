/**
 * GET   /api/user/llm-model  → { llmModel: string | null, tier: Tier }
 * PATCH /api/user/llm-model  body { llmModel: string | null } → { llmModel }
 *
 * Stores the user's preferred LLM. Any user can pick any model whose
 * `minTier` is reachable from their effective tier — including free
 * users picking among free-tier models (Haiku, Gemini Flash). Picking a
 * model above tier returns 402 with `tier_gate` so the client can open
 * the upgrade modal.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { getUserTier } from '@/lib/billing/tier';
import { getModelById } from '@/lib/llm/models';

const PatchSchema = z.object({
  llmModel: z
    .string()
    .regex(/^[a-z]+\/[a-z0-9.@\-]+$/, 'Must be provider/model format')
    .nullable(),
});

const tierOrder = { free: 0, plus: 1, pro: 2 } as const;

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  // Also returns `role` so client components that need to gate admin
  // UI (settings Admin tab, avatar dropdown Admin link) can read it
  // without an extra endpoint. Better Auth's client useSession()
  // doesn't surface `role` by default and adding it to additionalFields
  // is invasive — this endpoint is already fetched on settings load.
  const [row, tier] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, guard.user.id),
      columns: { llmModel: true, role: true },
    }),
    getUserTier(guard.user.id),
  ]);

  return NextResponse.json({
    llmModel: row?.llmModel ?? null,
    tier,
    role: row?.role ?? 'user',
  });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const tier = await getUserTier(guard.user.id);

  if (body.llmModel !== null) {
    const entry = getModelById(body.llmModel);
    if (!entry) {
      return NextResponse.json({ error: 'Unknown model id' }, { status: 400 });
    }

    if (tierOrder[tier] < tierOrder[entry.minTier]) {
      // Canonical 402 + `tier_gate` body shape so the client apiClient
      // helper can intercept and open the upgrade modal automatically.
      return NextResponse.json(
        {
          error: 'tier_gate',
          feature: 'model_choice',
          requiredTier: entry.minTier,
        },
        { status: 402 },
      );
    }
  }

  await db
    .update(schema.users)
    .set({ llmModel: body.llmModel })
    .where(eq(schema.users.id, guard.user.id))
    .returning({ llmModel: schema.users.llmModel });

  return NextResponse.json({ llmModel: body.llmModel });
}
