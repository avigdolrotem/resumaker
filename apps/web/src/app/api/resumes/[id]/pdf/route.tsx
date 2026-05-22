/**
 * GET /api/resumes/:id/pdf
 *
 * Server-side PDF rendering. Returns a PDF buffer.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { headers } from 'next/headers';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { ModernTemplate } from '@resumaker/resume-engine';
import { ResumeSchema } from '@resumaker/shared';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const row = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, id),
      eq(schema.resumes.userId, session.user.id),
      isNull(schema.resumes.deletedAt),
    ),
  });

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const parsed = ResumeSchema.safeParse(row.content);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid resume content' }, { status: 500 });
  }

  try {
    const pdfBuffer = await renderToBuffer(<ModernTemplate resume={parsed.data} />);
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${row.title}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[pdf] render error:', err);
    return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
  }
}
