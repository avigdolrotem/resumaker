/**
 * GET /api/resumes/[id]/export?format=txt|json
 *
 * Plain-text + JSON export for ATS form pastes and data portability.
 * PDF is the dedicated /pdf endpoint. DOCX deferred until we add a
 * docx library.
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
    const text = renderTxt(content);
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.txt"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    { error: 'Unsupported format', supported: ['txt', 'json'] },
    { status: 400 },
  );
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
