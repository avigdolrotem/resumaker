/**
 * GET /api/cron/onboarding-emails
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
 *
 * NOTE: Vercel Cron sends GET, so this MUST be exported as GET.
 * The route previously exported POST and never fired in production.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gte, isNull, lt, sql, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email/client';
import { escapeHtml } from '@/lib/email/templates';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';
import {
  COMPANY_ADDRESS_EN,
  COMPANY_ADDRESS_HE,
  COMPANY_LEGAL_NAME,
  COMPANY_TRADING_NAME,
  SUPPORT_EMAIL,
} from '@/lib/constants/contact';

/**
 * Israeli Spam Law (תיקון 40 לחוק התקשורת, 2008) requires every
 * commercial communication to:
 *   1. Begin with "פרסומת" in the subject line (Hebrew) — we mirror the
 *      bracket convention "[Advertisement]" for English to make the
 *      promotional nature equally clear in either language.
 *   2. Identify the sender by full legal name + means of contact.
 *   3. Include a clear opt-out / unsubscribe mechanism.
 * Day-30 ("we miss you") is unambiguously promotional. Day-1/3/7 are
 * onboarding nudges that arguably qualify as transactional follow-up,
 * but we treat them the same way for safety — the cost is one extra
 * word in the subject line; the legal cost of being wrong is ₪1,000
 * per recipient under §30A.
 */
function withMarketingPrefix(subject: string, locale: string): string {
  return locale === 'he' ? `פרסומת · ${subject}` : `[Advertisement] ${subject}`;
}

function senderFooter(locale: string): string {
  if (locale === 'he') {
    return `
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
<p style="color:#6b7280;font-size:12px;line-height:1.6">
  הודעה זו נשלחה אליך כי נרשמת ל-${escapeHtml(COMPANY_TRADING_NAME)}.<br />
  לביטול קבלת מיילים שיווקיים: <a href="${env.APP_URL}/he/settings?tab=notifications">הגדרות התראות</a>
  או השב למייל זה עם המילה "הסר".<br />
  השולח: ${escapeHtml(COMPANY_LEGAL_NAME)} · ${escapeHtml(COMPANY_ADDRESS_HE)} ·
  <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
</p>`;
  }
  return `
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
<p style="color:#6b7280;font-size:12px;line-height:1.6">
  You received this because you signed up for ${escapeHtml(COMPANY_TRADING_NAME)}.<br />
  To unsubscribe from marketing emails: <a href="${env.APP_URL}/en/settings?tab=notifications">notification settings</a>
  or reply with "UNSUBSCRIBE".<br />
  Sender: ${escapeHtml(COMPANY_LEGAL_NAME)} · ${escapeHtml(COMPANY_ADDRESS_EN)} ·
  <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
</p>`;
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
  // user.name is user-controlled. Anything that lands in `${first}` could
  // include <script>...</script> or HTML attribute breakouts and self-XSS
  // (or worse, if the same template gets re-rendered server-side in a
  // future admin "preview drip" tool). Escape before interpolating.
  const first = escapeHtml(name?.split(' ')[0] ?? '');
  const footer = senderFooter(locale);

  if (locale === 'he') {
    if (dayTag === 'day1')
      return {
        subject: withMarketingPrefix('בנה את קורות החיים הראשונים שלך תוך 5 דקות', locale),
        html: `<p>שלום ${first},</p><p>שמחים שהצטרפת ל-Resumaker. הדבק תיאור משרה אחד וקבל קורות חיים מותאמים תוך דקה.</p><p><a href="${env.APP_URL}/he/builder">התחל עכשיו →</a></p>${footer}`,
      };
    if (dayTag === 'day3')
      return {
        subject: withMarketingPrefix('תקועים? הנה איך להתחיל', locale),
        html: `<p>שלום ${first},</p><p>שמנו לב שעדיין לא יצרת קורות חיים. הדוגמה שלנו תיתן לך מושג מהיר.</p><p><a href="${env.APP_URL}/he/builder">בנה קורות חיים ראשונים →</a></p>${footer}`,
      };
    if (dayTag === 'day7')
      return {
        subject: withMarketingPrefix('נסה את יוצר מכתבי ההצעה', locale),
        html: `<p>שלום ${first},</p><p>יש לך קורות חיים — עכשיו שדרג עם מכתב הצעה מותאם AI לכל משרה.</p><p><a href="${env.APP_URL}/he/cover-letters/new">צור מכתב הצעה →</a></p>${footer}`,
      };
    return {
      subject: withMarketingPrefix('התגעגענו אליך', locale),
      html: `<p>שלום ${first},</p><p>לא ראינו אותך כבר שבועיים. הוספנו תבניות חדשות + פיצ׳ר חיפוש משרות בביתא.</p><p><a href="${env.APP_URL}/he/dashboard">חזור לפעולה →</a></p>${footer}`,
    };
  }
  if (dayTag === 'day1')
    return {
      subject: withMarketingPrefix('Build your first resume in 5 minutes', locale),
      html: `<p>Hi ${first},</p><p>Glad you joined Resumaker. Paste a job description and get a tailored resume in a minute.</p><p><a href="${env.APP_URL}/en/builder">Start now →</a></p>${footer}`,
    };
  if (dayTag === 'day3')
    return {
      subject: withMarketingPrefix("Stuck? Here's how to start", locale),
      html: `<p>Hi ${first},</p><p>We noticed you haven\'t created a resume yet. Our sample template will give you a quick feel.</p><p><a href="${env.APP_URL}/en/builder">Build your first →</a></p>${footer}`,
    };
  if (dayTag === 'day7')
    return {
      subject: withMarketingPrefix('Try the cover letter generator', locale),
      html: `<p>Hi ${first},</p><p>You have a resume — now level up with an AI-tailored cover letter for each job.</p><p><a href="${env.APP_URL}/en/cover-letters/new">Generate one →</a></p>${footer}`,
    };
  return {
    subject: withMarketingPrefix('We miss you', locale),
    html: `<p>Hi ${first},</p><p>We haven\'t seen you in two weeks. New templates + a job-hunt beta are now live.</p><p><a href="${env.APP_URL}/en/dashboard">Come back →</a></p>${footer}`,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

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
      // CRITICAL: sendEmail returns {ok:false} on Resend errors instead
      // of throwing. We MUST check .ok before calling markSent — otherwise
      // a failed send is recorded as sent and the user never gets retried.
      const result = await sendEmail({ to: u.email, subject: tmpl.subject, html: tmpl.html });
      if (!result.ok) {
        errors.push(`day1:${u.id}:${result.error ?? 'send_failed'}`);
        continue;
      }
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
      const result = await sendEmail({ to: u.email, subject: tmpl.subject, html: tmpl.html });
      if (!result.ok) {
        errors.push(`day30:${u.id}:${result.error ?? 'send_failed'}`);
        continue;
      }
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

  // Use error level when there are failures so Vercel cron dashboard
  // surfaces them; success:true was previously returned even with errors.
  const ok = errors.length === 0;
  const log = ok ? logger.info : logger.error;
  log.bind(logger)({ sent, skipped, errorCount: errors.length, errors }, 'cron.onboarding_emails');

  return NextResponse.json({ success: ok, sent, skipped, errors });
}
