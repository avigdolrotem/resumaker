/**
 * GET   /api/user/llm-model  → { llmModel: string | null, tier: Tier }
 * PATCH /api/user/llm-model  body { llmModel: string | null } → { llmModel }
 *
 * Stores the user's preferred LLM. Free users cannot PATCH a non-null
 * value (tier gate); Plus/Pro can pick any model their tier allows.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { canChooseLLM, getUserTier } from '@/lib/billing/tier';
import { getModelById } from '@/lib/llm/models';

const PatchSchema = z.object({
  llmModel: z
    .string()
    .regex(/^[a-z]+\/[a-z0-9.\-]+$/, 'Must be provider/model format')
    .nullable(),
});

const tierOrder = { free: 0, plus: 1, pro: 2 } as const;

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row, tier] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      columns: { llmModel: true },
    }),
    getUserTier(session.user.id),
  ]);

  return NextResponse.json({ llmModel: row?.llmModel ?? null, tier });
}

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

  const tier = await getUserTier(session.user.id);

  if (body.llmModel !== null) {
    const gate = canChooseLLM(tier);
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: 'Model selection requires Plus or Pro',
          code: 'TIER_LIMIT',
          reasonKey: gate.reasonKey,
        },
        { status: 402 },
      );
    }

    const entry = getModelById(body.llmModel);
    if (!entry) {
      return NextResponse.json({ error: 'Unknown model id' }, { status: 400 });
    }

    if (tierOrder[tier] < tierOrder[entry.minTier]) {
      return NextResponse.json(
        { error: 'This model requires a higher tier', requiredTier: entry.minTier },
        { status: 402 },
      );
    }
  }

  await db
    .update(schema.users)
    .set({ llmModel: body.llmModel })
    .where(eq(schema.users.id, session.user.id))
    .returning({ llmModel: schema.users.llmModel });

  return NextResponse.json({ llmModel: body.llmModel });
}
