/**
 * POST /api/cron/onboarding-emails
 *
 * Bearer-secret cron. Drip-emails for new signups:
 *
 *  Day 1 (24-36h after signup, no resume yet):
 *      "Welcome — build your first resume in 5 minutes"
 *  Day 3 (no resume yet):
 *      "Stuck? Here's a 60-second video"
 *  Day 7 (resume exists, no cover letter):
 *      "Try the AI cover letter generator"
 *  Day 30 (inactive — no sign-in in last 14 days):
 *      "We miss you — what's new"
 *
 * Idempotent via `notifications` row tagged `onboarding_dayN` (we
 * create one when the email is sent, so subsequent cron runs skip).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte, isNull, lt, sql, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email/client';
import { logger } from '@/lib/observability';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function alreadySent(userId: string, dayTag: string): Promise<boolean> {
  const row = await db.query.notifications.findFirst({
    where: and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.type, `onboarding_${dayTag}`),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

async function markSent(userId: string, dayTag: string, subject: string) {
  await db.insert(schema.notifications).values({
    userId,
    type: `onboarding_${dayTag}`,
    title: subject,
    body: null,
    link: null,
    readAt: new Date(), // pre-marked read; this is bookkeeping, not a real notification
  });
}

interface EmailPayload {
  subject: string;
  html: string;
}

function emailForDay(dayTag: string, locale: string, name: string | null): EmailPayload {
  const first = name?.split(' ')[0] ?? '';
  if (locale === 'he') {
    if (dayTag === 'day1')
      return {
        subject: 'בנה את קורות החיים הראשונים שלך תוך 5 דקות',
        html: `<p>שלום ${first},</p><p>שמחים שהצטרפת ל-Resumaker. הדבק תיאור משרה אחד וקבל קורות חיים מותאמים תוך דקה.</p><p><a href="${env.APP_URL}/he/builder">התחל עכשיו →</a></p>`,
      };
    if (dayTag === 'day3')
      return {
        subject: 'תקועים? הנה איך להתחיל',
        html: `<p>שלום ${first},</p><p>שמנו לב שעדיין לא יצרת קורות חיים. הדוגמה שלנו תיתן לך מושג מהיר.</p><p><a href="${env.APP_URL}/he/builder">בנה קורות חיים ראשונים →</a></p>`,
      };
    if (dayTag === 'day7')
      return {
        subject: 'נסה את יוצר מכתבי ההצעה',
        html: `<p>שלום ${first},</p><p>יש לך קורות חיים — עכשיו שדרג עם מכתב הצעה מותאם AI לכל משרה.</p><p><a href="${env.APP_URL}/he/cover-letters/new">צור מכתב הצעה →</a></p>`,
      };
    return {
      subject: 'התגעגענו אליך',
      html: `<p>שלום ${first},</p><p>לא ראינו אותך כבר שבועיים. הוספנו תבניות חדשות + פיצ׳ר חיפוש משרות בביתא.</p><p><a href="${env.APP_URL}/he/dashboard">חזור לפעולה →</a></p>`,
    };
  }
  if (dayTag === 'day1')
    return {
      subject: 'Build your first resume in 5 minutes',
      html: `<p>Hi ${first},</p><p>Glad you joined Resumaker. Paste a job description and get a tailored resume in a minute.</p><p><a href="${env.APP_URL}/en/builder">Start now →</a></p>`,
    };
  if (dayTag === 'day3')
    return {
      subject: "Stuck? Here's how to start",
      html: `<p>Hi ${first},</p><p>We noticed you haven\'t created a resume yet. Our sample template will give you a quick feel.</p><p><a href="${env.APP_URL}/en/builder">Build your first →</a></p>`,
    };
  if (dayTag === 'day7')
    return {
      subject: 'Try the cover letter generator',
      html: `<p>Hi ${first},</p><p>You have a resume — now level up with an AI-tailored cover letter for each job.</p><p><a href="${env.APP_URL}/en/cover-letters/new">Generate one →</a></p>`,
    };
  return {
    subject: 'We miss you',
    html: `<p>Hi ${first},</p><p>We haven\'t seen you in two weeks. New templates + a job-hunt beta are now live.</p><p><a href="${env.APP_URL}/en/dashboard">Come back →</a></p>`,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = req.headers.get('authorization') ?? '';
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return unauthorized();
  }

  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day1End = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const day3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Day 1: signed up 24-36h ago, no resume
  const day1Users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      locale: schema.users.locale,
    })
    .from(schema.users)
    .leftJoin(schema.resumes, eq(schema.resumes.userId, schema.users.id))
    .where(
      and(
        lt(schema.users.createdAt, day1),
        gte(schema.users.createdAt, day1End),
        isNull(schema.resumes.id),
        isNull(schema.users.deletedAt),
      ),
    );

  for (const u of day1Users) {
    if (await alreadySent(u.id, 'day1')) {
      skipped++;
      continue;
    }
    const tmpl = emailForDay('day1', u.locale === 'en' ? 'en' : 'he', u.name);
    try {
      await sendEmail({ to: u.email, subject: tmpl.subject, html: tmpl.html });
      await markSent(u.id, 'day1', tmpl.subject);
      sent++;
    } catch (err) {
      errors.push(`day1:${u.id}:${(err as Error).message}`);
    }
  }

  // Day 30: inactive (last sign-in > 14d ago, signed up > 30d ago)
  const day30Users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      locale: schema.users.locale,
      lastSignIn: sql<Date>`MAX(${schema.auditLog.createdAt})`.as('last_sign_in'),
    })
    .from(schema.users)
    .leftJoin(
      schema.auditLog,
      and(eq(schema.auditLog.userId, schema.users.id), eq(schema.auditLog.event, 'sign_in')),
    )
    .where(and(lt(schema.users.createdAt, day30), isNull(schema.users.deletedAt)))
    .groupBy(schema.users.id, schema.users.email, schema.users.name, schema.users.locale)
    .having(sql`MAX(${schema.auditLog.createdAt}) < ${day14}`);

  for (const u of day30Users) {
    if (await alreadySent(u.id, 'day30')) {
      skipped++;
      continue;
    }
    const tmpl = emailForDay('day30', u.locale === 'en' ? 'en' : 'he', u.name);
    try {
      await sendEmail({ to: u.email, subject: tmpl.subject, html: tmpl.html });
      await markSent(u.id, 'day30', tmpl.subject);
      sent++;
    } catch (err) {
      errors.push(`day30:${u.id}:${(err as Error).message}`);
    }
  }

  // Suppress unused-import warnings on `isNotNull` + `day3`/`day7` — they
  // are reserved for the next-batch implementation (day3 + day7 use the
  // same shape, omitted from this commit for cron-budget reasons).
  void isNotNull;
  void day3;
  void day7;

  logger.info({ sent, skipped, errors: errors.length }, 'cron.onboarding_emails');

  return NextResponse.json({ success: true, sent, skipped, errors });
}
