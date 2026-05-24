/**
 * Shared authorization helpers.
 *
 * Three guards used across every protected route + admin page:
 *  - requireSession       — 401 if not signed in
 *  - requireActiveUser    — 403 if role=suspended (sessions get deleted
 *                           on suspend, but Better Auth issues fresh
 *                           ones on re-sign-in; this is the safety net)
 *  - requireAdmin         — 404 if not admin (we mimic "page doesn't
 *                           exist" instead of 403 so admin URLs don't
 *                           announce themselves to non-admins)
 *  - requireFreshSession  — 401 if session was created more than
 *                           `maxAgeSeconds` ago. Re-auth required for
 *                           destructive actions (delete account, change
 *                           password, open billing portal, etc.).
 *
 * All helpers accept the Headers from a Next.js request and return either
 * a fully-loaded `{ session, user }` tuple or a NextResponse to short-circuit
 * the caller. Pattern:
 *
 *   const guard = await requireAdmin(await headers());
 *   if (guard instanceof NextResponse) return guard;
 *   // safe to use guard.session, guard.user
 */

import { NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth, type Session } from '@/lib/auth';
import { db, schema } from '@/db';

interface Guarded {
  session: Session;
  /** The fresh `users` row at guard time — has role + locale + deletedAt */
  user: typeof schema.users.$inferSelect;
}

async function loadSessionAndUser(headers: Headers): Promise<Guarded | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user) return null;
  return { session: session as Session, user };
}

export async function requireSession(headers: Headers): Promise<Guarded | NextResponse> {
  const loaded = await loadSessionAndUser(headers);
  if (!loaded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return loaded;
}

export async function requireActiveUser(headers: Headers): Promise<Guarded | NextResponse> {
  const loaded = await loadSessionAndUser(headers);
  if (!loaded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (loaded.user.role === 'suspended' || loaded.user.deletedAt) {
    // Drop the session so the user is bounced on next request too.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, loaded.user.id));
    return NextResponse.json(
      { error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 },
    );
  }
  return loaded;
}

export async function requireAdmin(headers: Headers): Promise<Guarded | NextResponse> {
  const guard = await requireActiveUser(headers);
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'admin') {
    // 404 instead of 403 — don't reveal admin endpoints to non-admins
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return guard;
}

/**
 * Re-auth gate for destructive actions. Returns 401 with `code: STALE_SESSION`
 * if the session is older than `maxAgeSeconds`. The client should redirect
 * the user to /sign-in with a returnTo parameter; on next sign-in the new
 * session is fresh.
 *
 * `freshSession.expiresAt - now()` would be expressed in remaining seconds
 * relative to absolute lifetime, which doesn't tell us session age. So we
 * read the session row's `createdAt` directly.
 */
export async function requireFreshSession(
  headers: Headers,
  maxAgeSeconds: number,
): Promise<Guarded | NextResponse> {
  const guard = await requireActiveUser(headers);
  if (guard instanceof NextResponse) return guard;

  const row = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, guard.session.session.id),
    columns: { createdAt: true },
  });
  if (!row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 401 });
  }
  const ageSeconds = (Date.now() - row.createdAt.getTime()) / 1000;
  if (ageSeconds > maxAgeSeconds) {
    return NextResponse.json(
      {
        error: 'Re-authentication required',
        code: 'STALE_SESSION',
        maxAgeSeconds,
        ageSeconds: Math.floor(ageSeconds),
      },
      { status: 401 },
    );
  }
  return guard;
}

// ─────────────────────────────────────────────────────────────────────
// SSR variants — for Server Components, which can't return NextResponse.
// They throw via next/navigation (redirect or notFound), which Next.js
// catches at the page boundary. Mirror the API-side helpers in behavior.
// ─────────────────────────────────────────────────────────────────────

/**
 * Page-side admin guard. Use at the top of every admin Server Component:
 *
 *   const { user } = await requireAdminPage();
 *
 * If the caller isn't admin, this `notFound()`s — mimicking the
 * "page doesn't exist" stance the API helper takes (avoids announcing
 * the existence of admin endpoints to logged-in non-admins).
 */
export async function requireAdminPage(): Promise<Guarded> {
  const loaded = await loadSessionAndUser(await nextHeaders());
  if (!loaded) {
    redirect('/sign-in');
  }
  if (loaded.user.role === 'suspended' || loaded.user.deletedAt) {
    redirect('/sign-in?reason=suspended');
  }
  if (loaded.user.role !== 'admin') {
    notFound();
  }
  return loaded;
}
