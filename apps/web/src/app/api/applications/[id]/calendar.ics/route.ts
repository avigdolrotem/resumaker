/**
 * GET /api/applications/[id]/calendar.ics — download an .ics file with
 * the application's `nextActionAt` as a calendar event.
 *
 * Generated inline (no library) — iCalendar is just text with strict
 * line endings. Browsers + Outlook + Google Calendar all accept this.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

function toICalDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  const app = await db
    .select({
      jobTitle: schema.jobs.title,
      jobCompany: schema.jobs.company,
      jobUrl: schema.jobs.url,
      status: schema.applications.status,
      nextActionAt: schema.applications.nextActionAt,
      notes: schema.applications.notes,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, guard.user.id)))
    .limit(1);

  if (!app[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const a = app[0];

  if (!a.nextActionAt) {
    return NextResponse.json(
      { error: 'No nextActionAt set — add a reminder first' },
      { status: 400 },
    );
  }

  const start = toICalDate(a.nextActionAt);
  const end = toICalDate(new Date(a.nextActionAt.getTime() + 30 * 60 * 1000)); // +30min
  const now = toICalDate(new Date());

  const summary = `Resumaker: ${a.status} — ${a.jobTitle} at ${a.jobCompany}`;
  const description = [a.notes, `Job: ${a.jobUrl}`].filter(Boolean).join('\\n\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Resumaker//Application Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@resumaker.co.il`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary.replace(/,/g, '\\,').replace(/;/g, '\\;')}`,
    `DESCRIPTION:${description.replace(/,/g, '\\,').replace(/;/g, '\\;')}`,
    `URL:${a.jobUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="application-${id.slice(0, 8)}.ics"`,
    },
  });
}
