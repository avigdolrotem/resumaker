/**
 * GET /api/account/export — GDPR/Israeli Privacy Law data portability.
 *
 * Returns a JSON file with everything we have about the current user.
 * Per GDPR Art. 15 / Israeli Privacy Law §13 (Right of Access), the
 * export must cover ALL personal data — not just the headline tables.
 *
 * What's included:
 *   - user             — profile (no password hash, no session token)
 *   - subscription     — tier, provider, lifecycle dates (no card data)
 *   - resumes          — full content (incl. soft-deleted)
 *   - resumeVersions   — append-only edit history
 *   - coverLetters     — full content (incl. soft-deleted)
 *   - generations      — LLM call metadata (no raw JD or output text)
 *   - atsScores        — keyword + suggestion arrays per resume
 *   - accounts         — OAuth provider links (id + provider only; tokens
 *                        scrubbed because they're credentials, not user data)
 *   - sessions         — login footprint (id + hashed IP + UA + dates)
 *   - auditEvents      — every audit-logged action (last 1000)
 *
 * What's deliberately excluded:
 *   - accounts.password / accessToken / refreshToken / idToken
 *   - sessions.token  (raw bearer for the session)
 *   - generations.inputJdHash / error stack traces
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, desc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // First wave — everything keyed directly on userId.
  const [user, subscription, resumes, coverLetters, generations, accounts, sessions, auditEvents] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        columns: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          image: true,
          locale: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, userId),
        columns: {
          tier: true,
          status: true,
          provider: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          grantedBy: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          // Provider customer/subscription IDs intentionally OMITTED — they're
          // identifiers for credentialed account access (e.g. opening the
          // billing portal), not user data the subject would want exported.
        },
      }),
      db.query.resumes.findMany({
        where: eq(schema.resumes.userId, userId),
        orderBy: [desc(schema.resumes.createdAt)],
      }),
      db.query.coverLetters.findMany({
        where: eq(schema.coverLetters.userId, userId),
        orderBy: [desc(schema.coverLetters.createdAt)],
      }),
      db.query.generations.findMany({
        where: eq(schema.generations.userId, userId),
        orderBy: [desc(schema.generations.createdAt)],
        columns: {
          id: true,
          resumeId: true,
          status: true,
          model: true,
          promptTokens: true,
          completionTokens: true,
          durationMs: true,
          detectedLocale: true,
          industry: true,
          inputLength: true,
          createdAt: true,
          // Deliberately excluded: inputJdHash (sha256), error stack traces
        },
      }),
      db.query.accounts.findMany({
        where: eq(schema.accounts.userId, userId),
        columns: {
          id: true,
          accountId: true,
          providerId: true,
          scope: true,
          createdAt: true,
          updatedAt: true,
          // Excluded: password hash, accessToken, refreshToken, idToken
        },
      }),
      db.query.sessions.findMany({
        where: eq(schema.sessions.userId, userId),
        columns: {
          id: true,
          expiresAt: true,
          ipAddress: true, // already HMAC-hashed by the session.create.before hook
          userAgent: true,
          createdAt: true,
          updatedAt: true,
          // Excluded: token (bearer credential, not user data)
        },
      }),
      db.query.auditLog.findMany({
        where: eq(schema.auditLog.userId, userId),
        orderBy: [desc(schema.auditLog.createdAt)],
        limit: 1000,
      }),
    ]);

  // Second wave — joined data that depends on the resume IDs we just loaded.
  const resumeIds = resumes.map((r) => r.id);
  const [resumeVersions, atsScores] = await Promise.all([
    resumeIds.length > 0
      ? db.query.resumeVersions.findMany({
          where: inArray(schema.resumeVersions.resumeId, resumeIds),
          orderBy: [desc(schema.resumeVersions.createdAt)],
        })
      : Promise.resolve([]),
    resumeIds.length > 0
      ? db.query.atsScores.findMany({
          where: inArray(schema.atsScores.resumeId, resumeIds),
          orderBy: [desc(schema.atsScores.createdAt)],
        })
      : Promise.resolve([]),
  ]);

  const exportData = {
    exportGeneratedAt: new Date().toISOString(),
    user,
    subscription,
    resumes,
    resumeVersions,
    coverLetters,
    generations,
    atsScores,
    accounts,
    sessions,
    auditEvents,
    notes: {
      privacy:
        'This export contains all personal data Resumaker stores about your account, per GDPR Art. 15 and Israeli Privacy Law §13.',
      retention:
        'Soft-deleted items (resumes, cover letters) are permanently purged 30 days after deletion. Audit events are retained for 1 year. Sessions expire 14 days after creation.',
      omitted:
        'Excluded for security: password hash, OAuth access/refresh tokens, session bearer tokens, payment provider customer IDs. These are credentials, not personal data — sharing them would put your account at risk.',
      contact: 'Questions? Email privacy@resumaker.co.il',
    },
  };

  const filename = `resumaker-export-${new Date().toISOString().split('T')[0]}.json`;
  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
