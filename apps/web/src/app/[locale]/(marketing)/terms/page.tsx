import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const isHebrew = locale === 'he';

  return (
    <article className="prose mx-auto max-w-3xl px-4 py-12">
      {isHebrew ? <TermsHe /> : <TermsEn />}
    </article>
  );
}

function TermsHe() {
  return (
    <>
      <h1>תנאי שימוש</h1>
      <p className="text-muted-foreground text-sm">עודכן לאחרונה: מאי 2026</p>

      <h2>1. שימוש בשירות</h2>
      <p>
        השימוש ב-Resumaker מותנה בקבלת תנאים אלה. השירות מיועד לבני 16+ ולשימוש אישי במסגרת חיפוש
        עבודה.
      </p>

      <h2>2. תוכן שנוצר</h2>
      <p>תוכן שנוצר באמצעות AI ניתן לעריכה ובדיקה על ידכם. אתם אחראים על דיוק וחוקיות התוכן.</p>

      <h2>3. הגבלות</h2>
      <ul>
        <li>אסור להעלות מידע פרטי של אחרים ללא הסכמתם.</li>
        <li>אסור לנסות לפרוץ או לזייף תגובות מהמערכת.</li>
        <li>אסור להשתמש בשירות לתוכן בלתי חוקי, מטעה, או פוגעני.</li>
      </ul>

      <h2>4. הפסקת שירות</h2>
      <p>אנו רשאים להפסיק לספק את השירות לחשבונות שמפרים את התנאים, עם הודעה מראש סבירה.</p>

      <h2>5. אחריות</h2>
      <p>
        השירות מסופק "כמות שהוא". איננו אחראים לתוצאות מהשימוש בקורות החיים שנוצרו (כגון: התקבלת/לא
        התקבלת לעבודה).
      </p>

      <h2>6. שינויים בתנאים</h2>
      <p>נודיע על שינויים מהותיים לפחות 14 יום מראש.</p>

      <h2>7. דין חל</h2>
      <p>חוקי מדינת ישראל חלים על תנאים אלה. סמכות שיפוט בלעדית: בתי המשפט בתל אביב.</p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated: May 2026</p>

      <h2>1. Service Use</h2>
      <p>
        Use of Resumaker is contingent on accepting these terms. The service is intended for users
        16+ for personal use in job searching.
      </p>

      <h2>2. Generated Content</h2>
      <p>
        AI-generated content is provided for your review and editing. You are responsible for the
        accuracy and legality of content you use.
      </p>

      <h2>3. Restrictions</h2>
      <ul>
        <li>Do not upload others' private information without consent.</li>
        <li>Do not attempt to break or manipulate the system.</li>
        <li>Do not use the service for illegal, deceptive, or harmful content.</li>
      </ul>

      <h2>4. Service Termination</h2>
      <p>We may terminate accounts that violate these terms, with reasonable notice.</p>

      <h2>5. Liability</h2>
      <p>
        The service is provided "as is". We are not liable for outcomes from using generated resumes
        (e.g., hiring decisions).
      </p>

      <h2>6. Changes to Terms</h2>
      <p>We will notify of material changes at least 14 days in advance.</p>

      <h2>7. Governing Law</h2>
      <p>These terms are governed by Israeli law. Exclusive jurisdiction: Tel Aviv courts.</p>
    </>
  );
}
