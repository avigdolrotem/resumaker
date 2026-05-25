/**
 * GET    /api/account/linked    — list OAuth providers linked to the
 *                                 current user
 * DELETE /api/account/linked    — unlink a provider (body: { providerId })
 *
 * "Linked accounts" surface in Settings → Security so users can
 * connect/disconnect Google/GitHub for one-click sign-in. Mirrors
 * Better Auth's account-linking config (lib/auth.ts).
 *
 * Unlink requires a fresh session AND that the user has at least one
 * other login method (email/password OR another linked provider) —
 * otherwise they'd lock themselves out.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser, requireFreshSession } from '@/lib/auth-guards';

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db.query.accounts.findMany({
    where: eq(schema.accounts.userId, guard.user.id),
    columns: {
      providerId: true,
      accountId: true,
      createdAt: true,
    },
  });

  // Separate the email/password "credential" account from OAuth links
  // — the client renders them differently. The `providerId` Better Auth
  // uses for password is `'credential'`.
  const credential = rows.find((r) => r.providerId === 'credential');
  const oauth = rows
    .filter((r) => r.providerId !== 'credential')
    .map((r) => ({
      providerId: r.providerId,
      accountId: r.accountId,
      linkedAt: r.createdAt,
    }));

  return NextResponse.json({
    hasPassword: Boolean(credential),
    oauth,
  });
}

const DeleteBody = z.object({
  providerId: z.enum(['google', 'github']),
});

export async function DELETE(req: NextRequest): Promise<Response> {
  // Fresh-session gate: unlinking is a credential change → require
  // re-auth within 15 min so a stolen cookie can't quietly remove the
  // user's OAuth tie.
  const guard = await requireFreshSession(await headers(), 15 * 60);
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof DeleteBody>;
  try {
    body = DeleteBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Safety: the user must still have a way to sign in after unlinking.
  // Counts: 1) password (credential account exists) + 2) every other
  // OAuth account. Must remain >= 1 after the unlink.
  const all = await db.query.accounts.findMany({
    where: eq(schema.accounts.userId, guard.user.id),
    columns: { providerId: true },
  });
  const remaining = all.filter((a) => a.providerId !== body.providerId).length;
  if (remaining < 1) {
    return NextResponse.json(
      {
        error: 'Cannot unlink your only sign-in method. Set a password first, then try again.',
        code: 'LAST_LOGIN_METHOD',
      },
      { status: 400 },
    );
  }

  // Perform the unlink — remove the accounts row.
  await db
    .delete(schema.accounts)
    .where(
      and(
        eq(schema.accounts.userId, guard.user.id),
        eq(schema.accounts.providerId, body.providerId),
      ),
    );

  auditEvent({
    userId: guard.user.id,
    event: 'oauth_unlinked',
    metadata: { provider: body.providerId },
  });

  return NextResponse.json({ success: true });
}
