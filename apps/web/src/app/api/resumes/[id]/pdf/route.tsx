/**
 * GET /api/resumes/:id/pdf
 *
 * Server-side PDF rendering with in-memory LRU cache.
 * Cache key includes the content hash so re-renders happen only when
 * the resume actually changes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { headers } from 'next/headers';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { renderTemplate } from '@resumaker/resume-engine';
import { ResumeSchema } from '@resumaker/shared';
import { get as pdfCacheGet, set as pdfCacheSet, makeKey as pdfCacheKey } from '@/lib/pdf-cache';
import { auditEvent } from '@/lib/audit';

export async function GET(
  _req: NextRequest,
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

  // Cache key includes templateId so switching templates invalidates the cache
  const cacheKey = pdfCacheKey(id, { template: row.templateId, content: row.content });
  const cached = pdfCacheGet(cacheKey);

  let pdfBuffer: Uint8Array;
  let fromCache = false;

  if (cached) {
    pdfBuffer = cached;
    fromCache = true;
  } else {
    try {
      const rendered = await renderToBuffer(
        renderTemplate(row.templateId, { resume: parsed.data }),
      );
      pdfBuffer = new Uint8Array(rendered);
      pdfCacheSet(cacheKey, pdfBuffer);
    } catch (err) {
      console.error('[pdf] render error:', err);
      return NextResponse.json({ error: 'PDF render failed' }, { status: 500 });
    }
  }

  auditEvent({
    userId: session.user.id,
    event: 'resume_downloaded_pdf',
    metadata: { resumeId: id, fromCache },
  });

  // Safe filename: strip control chars, quotes and path separators from
  // the user-controlled title; RFC 5987 filename* for non-ASCII (Hebrew
  // titles).
  //
  // The forward slash matters more than it looks here. Hebrew job titles
  // are routinely gendered with one — מפתח/ת, מנהל/ת, סייע/ת — so a
  // large share of Israeli listings produce a title containing a path
  // separator, and `title` ultimately comes from an LLM reading pasted
  // job text. Browsers do sanitize Content-Disposition filenames, which
  // is why this has looked fine in practice, but a path separator in a
  // filename shouldn't depend on the client choosing to defend itself.
  const sanitize = (s: string) => s.replace(/[/\\]/g, '_');
  const safeAscii = sanitize(row.title)
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 100);
  const utf8Encoded = encodeURIComponent(sanitize(row.title));

  return new Response(pdfBuffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeAscii}.pdf"; filename*=UTF-8''${utf8Encoded}.pdf`,
      'Cache-Control': 'private, no-store',
      'X-Cache': fromCache ? 'HIT' : 'MISS',
    },
  });
}
