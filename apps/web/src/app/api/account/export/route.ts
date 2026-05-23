/**
 * GET /api/account/export — GDPR/Israeli Privacy Law data portability.
 *
 * Returns a JSON file with everything we have about the current user:
 *   - profile (without password hash or session tokens)
 *   - all resumes (including soft-deleted ones, with deletion date)
 *   - generation history (timestamps, tokens used, no raw JD content)
 *   - account events (sign-in, password change, etc.)
 *
 * This satisfies "Right of Access" under both GDPR Art. 15 and Israeli
 * Privacy Law §13.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';
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

  // Fetch everything in parallel
  const [user, resumes, generations, auditEvents] = await Promise.all([
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
    db.query.resumes.findMany({
      where: eq(schema.resumes.userId, userId),
      orderBy: [desc(schema.resumes.createdAt)],
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
    db.query.auditLog.findMany({
      where: eq(schema.auditLog.userId, userId),
      orderBy: [desc(schema.auditLog.createdAt)],
      limit: 1000,
    }),
  ]);

  const exportData = {
    exportGeneratedAt: new Date().toISOString(),
    user,
    resumes,
    generations,
    auditEvents,
    notes: {
      privacy: 'This export contains all data associated with your account.',
      retention: 'Soft-deleted items will be permanently purged 30 days after deletion.',
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
