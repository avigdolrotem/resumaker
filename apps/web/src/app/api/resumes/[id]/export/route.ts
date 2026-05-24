/**
 * GET /api/resumes/[id]/export?format=txt|json|docx
 *
 * Plain-text + JSON + Word-compatible DOC export.
 *
 * DOC implementation: emit HTML with `application/msword` Content-Type.
 * Microsoft Word, Google Docs, LibreOffice, Pages, and every major ATS
 * (Greenhouse, Lever, Workable, iCIMS) open this correctly and detect
 * the document structure. Avoids a heavy `docx` library dependency.
 *
 * PDF stays on the dedicated /pdf endpoint (React-PDF rendering).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

type ResumeContent = {
  metadata?: { language?: string };
  contact?: { name?: string; email?: string; phone?: string; location?: string; linkedin?: string };
  summary?: string;
  experience?: Array<{
    title: string;
    company: string;
    start_date: string;
    end_date?: string | null;
    highlights?: string[];
  }>;
  education?: Array<{ degree: string; institution: string }>;
  skills?: string[];
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  const resume = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, id),
      eq(schema.resumes.userId, guard.user.id),
      isNull(schema.resumes.deletedAt),
    ),
  });
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const content = resume.content as ResumeContent;
  const safeName = resume.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

  if (format === 'json') {
    return new Response(JSON.stringify(content, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeName}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'txt') {
    return new Response(renderTxt(content), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.txt"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'docx' || format === 'doc') {
    return new Response(renderDoc(content), {
      status: 200,
      headers: {
        // 'application/msword' is the widest-compatible MIME — Word opens
        // it natively, ATS parsers treat it as a Word doc, and we don't
        // need a heavy DOCX library. The .doc extension also matches.
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="${safeName}.doc"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    { error: 'Unsupported format', supported: ['txt', 'json', 'doc'] },
    { status: 400 },
  );
}

function escapeHtml(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTxt(c: ResumeContent): string {
  const lines: string[] = [];
  if (c.contact?.name) lines.push(c.contact.name);
  const contactBits = [
    c.contact?.email,
    c.contact?.phone,
    c.contact?.location,
    c.contact?.linkedin,
  ].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(' | '));
  lines.push('');

  if (c.summary) {
    lines.push('SUMMARY');
    lines.push(c.summary);
    lines.push('');
  }

  if (c.experience?.length) {
    lines.push('EXPERIENCE');
    for (const e of c.experience) {
      const dates = `${e.start_date} - ${e.end_date ?? 'Present'}`;
      lines.push(`${e.title} | ${e.company} | ${dates}`);
      for (const h of e.highlights ?? []) lines.push(`  - ${h}`);
      lines.push('');
    }
  }

  if (c.education?.length) {
    lines.push('EDUCATION');
    for (const ed of c.education) lines.push(`${ed.degree} - ${ed.institution}`);
    lines.push('');
  }

  if (c.skills?.length) {
    lines.push('SKILLS');
    lines.push(c.skills.join(', '));
  }

  return lines.join('\n');
}

/**
 * Word-compatible HTML. Uses MS Office namespaces in the html tag so
 * Word treats this as a native document instead of importing-from-web.
 * Direction is set per-locale so Hebrew renders RTL out of the box.
 */
function renderDoc(c: ResumeContent): string {
  const isRtl = c.metadata?.language === 'he' || c.metadata?.language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const lang = c.metadata?.language ?? 'en';

  const parts: string[] = [];
  parts.push(`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word">
<title>${escapeHtml(c.contact?.name) || 'Resume'}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.45; }
  h1 { font-size: 22pt; margin: 0 0 4pt 0; }
  h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1pt; color: #4338ca; border-bottom: 1pt solid #999; padding-bottom: 2pt; margin: 14pt 0 6pt 0; }
  .contact { color: #555; margin-bottom: 14pt; font-size: 10pt; }
  .role { font-weight: bold; }
  .meta { color: #555; font-size: 10pt; }
  ul { margin: 4pt 0 8pt 18pt; padding: 0; }
  li { margin-bottom: 2pt; }
  .skills { line-height: 1.7; }
</style>
</head>
<body>`);

  if (c.contact?.name) parts.push(`<h1>${escapeHtml(c.contact.name)}</h1>`);
  const contactBits = [c.contact?.email, c.contact?.phone, c.contact?.location, c.contact?.linkedin]
    .filter(Boolean)
    .map((s) => escapeHtml(s));
  if (contactBits.length) parts.push(`<p class="contact">${contactBits.join(' &middot; ')}</p>`);

  if (c.summary) {
    parts.push(`<h2>${isRtl ? 'תקציר' : 'Summary'}</h2>`);
    parts.push(`<p>${escapeHtml(c.summary)}</p>`);
  }

  if (c.experience?.length) {
    parts.push(`<h2>${isRtl ? 'ניסיון תעסוקתי' : 'Experience'}</h2>`);
    for (const e of c.experience) {
      const dates = `${escapeHtml(e.start_date)} &ndash; ${escapeHtml(e.end_date ?? (isRtl ? 'היום' : 'Present'))}`;
      parts.push(
        `<p><span class="role">${escapeHtml(e.title)}</span> &middot; ${escapeHtml(e.company)} <span class="meta">(${dates})</span></p>`,
      );
      if (e.highlights?.length) {
        parts.push('<ul>');
        for (const h of e.highlights) parts.push(`<li>${escapeHtml(h)}</li>`);
        parts.push('</ul>');
      }
    }
  }

  if (c.education?.length) {
    parts.push(`<h2>${isRtl ? 'השכלה' : 'Education'}</h2>`);
    for (const ed of c.education) {
      parts.push(
        `<p><span class="role">${escapeHtml(ed.degree)}</span> &middot; ${escapeHtml(ed.institution)}</p>`,
      );
    }
  }

  if (c.skills?.length) {
    parts.push(`<h2>${isRtl ? 'כישורים' : 'Skills'}</h2>`);
    parts.push(`<p class="skills">${c.skills.map((s) => escapeHtml(s)).join(' &middot; ')}</p>`);
  }

  parts.push('</body></html>');
  return parts.join('\n');
}
