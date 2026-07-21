/**
 * POST /api/account/sample-data — populate the calling user's account
 * with one sample resume + one sample cover letter so first-timers
 * have something to play with.
 *
 * No-op if the user already has any resume (won't overwrite their work).
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser } from '@/lib/auth-guards';

const SAMPLE_RESUME = {
  metadata: { language: 'he' as const, generated_at: new Date().toISOString(), template: 'modern' },
  contact: {
    name: 'דנה כהן',
    email: 'dana@example.com',
    phone: '050-0000000',
    location: 'תל אביב',
    linkedin: 'linkedin.com/in/example',
  },
  summary:
    'מהנדסת תוכנה עם 5 שנות ניסיון בבניית מערכות web בקנה מידה. מתמחה ב-TypeScript, React ו-Node.js. אוהבת לפתור בעיות מורכבות עם פתרונות פשוטים.',
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'Wix.com',
      start_date: '2022',
      end_date: null,
      highlights: [
        'הובלתי צוות של 4 מפתחים לבניית פלטפורמת checkout שמטפלת ב-1M+ עסקאות חודשיות',
        'שיפרתי זמן טעינה ב-40% עבור 50M+ משתמשים פעילים חודשית',
        'בניתי מערכת A/B testing פנימית שנמצאת בשימוש על ידי 15+ צוותים',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'Monday.com',
      start_date: '2020',
      end_date: '2022',
      highlights: [
        'פיתחתי features עיקריים ב-React + TypeScript',
        'הובלתי מיגרציה מ-Redux ל-Zustand שפשטה את הקוד ב-30%',
      ],
    },
  ],
  education: [
    {
      institution: 'אוניברסיטת תל אביב',
      degree: 'B.Sc. במדעי המחשב',
      start_date: '2016',
      end_date: '2019',
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL'],
};

const SAMPLE_COVER_LETTER = `שלום,

אני מתעניינת בתפקיד Senior Software Engineer שראיתי במשרה שלכם. עם 5 שנות ניסיון בבניית מערכות web בקנה מידה ב-Wix ו-Monday.com, אני בטוחה שאוכל להוסיף ערך משמעותי לצוות שלכם.

הניסיון שלי כולל הובלת צוותי פיתוח, בניית פתרונות performance עבור מיליוני משתמשים, ופיתוח features שמשפיעים ישירות על ההכנסות. אני מתמחה ב-TypeScript ו-React.

אשמח לשמוע עוד על האתגרים שאתם מתמודדים איתם.

בברכה,
דנה`;

export async function POST(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  // Don't overwrite — only seed for truly empty accounts.
  const existing = await db.query.resumes.findFirst({
    where: and(eq(schema.resumes.userId, guard.user.id), isNull(schema.resumes.deletedAt)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a resume — sample data not loaded' },
      { status: 409 },
    );
  }

  const [resume] = await db
    .insert(schema.resumes)
    .values({
      userId: guard.user.id,
      title: 'דוגמה — דנה כהן',
      jobTitle: 'מהנדסת תוכנה בכירה',
      companyName: 'חברת הייטק לדוגמה',
      locale: 'he',
      templateId: 'modern',
      content: SAMPLE_RESUME,
    })
    .returning({ id: schema.resumes.id });

  const [coverLetter] = await db
    .insert(schema.coverLetters)
    .values({
      userId: guard.user.id,
      title: 'דוגמה — מכתב הצעה',
      content: SAMPLE_COVER_LETTER,
      tone: 'formal',
      locale: 'he',
    })
    .returning({ id: schema.coverLetters.id });

  auditEvent({
    userId: guard.user.id,
    event: 'profile_updated',
    metadata: { kind: 'sample_data_loaded', resumeId: resume?.id, coverLetterId: coverLetter?.id },
  });

  return NextResponse.json({
    success: true,
    resumeId: resume?.id,
    coverLetterId: coverLetter?.id,
  });
}
