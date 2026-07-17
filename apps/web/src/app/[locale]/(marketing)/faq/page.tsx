import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScrollReveal } from '@/components/scroll-reveal';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GlassPanel } from '@/components/ui-effects/glass-panel';

/**
 * /[locale]/faq — frequently asked questions.
 *
 * Static MDX-free version (just a translated array) — keeps the bundle
 * tiny and avoids adding an MDX toolchain. When we have >20 FAQs we
 * migrate to MDX.
 */

const QUESTIONS_EN = [
  {
    q: 'Is Resumaker free?',
    a: 'Yes — the Free tier lets you create up to 2 resumes with our Modern template and includes basic ATS scoring. Plus and Pro unlock more templates, unlimited resumes, cover letters, and the job-hunt beta.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Encrypted in Google Cloud SQL Postgres in the europe-west1 region (Belgium, EU). We never sell data and never use it to train AI models. Full GDPR + Israeli Privacy Law compliance.',
  },
  {
    q: 'Which AI model do you use?',
    a: 'Anthropic Claude (Sonnet for resume generation, Haiku for cheaper extraction tasks). Pro users will be able to pick the model.',
  },
  {
    q: 'How does ATS scoring work?',
    a: 'We extract keywords from the job description, compare them with your resume, and score 0-100. The detail card shows what matched and what is missing.',
  },
  {
    q: 'Can I edit my resume after AI generates it?',
    a: 'Yes — open it from your dashboard and edit any field. Every save creates a new version so you can roll back.',
  },
  {
    q: 'Do you support Hebrew?',
    a: 'Hebrew is the primary language. The UI, AI prompts, and PDF templates all handle RTL correctly. English is a one-click toggle.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Settings → Billing → Manage subscription. Cancellation is immediate (you keep access until the period ends).',
  },
  {
    q: 'Is the job-hunt feature live?',
    a: 'It is in beta. Sign in, then contact support to enable the feature flag for your account.',
  },
];

const QUESTIONS_HE = [
  {
    q: 'האם Resumaker חינמי?',
    a: 'כן — המסלול החינמי מאפשר עד 2 קורות חיים עם תבנית Modern וניקוד ATS בסיסי. Plus ו-Pro פותחים תבניות נוספות, ללא הגבלה, מכתבי הצעה, וביתא חיפוש משרות.',
  },
  {
    q: 'איפה הנתונים שלי נשמרים?',
    a: 'מוצפנים ב-Google Cloud SQL Postgres באזור europe-west1 (בלגיה, אירופה). לא מוכרים נתונים ולא משתמשים בהם לאימון מודלי AI. תאימות מלאה ל-GDPR וחוק הגנת הפרטיות.',
  },
  {
    q: 'באיזה מודל AI אתם משתמשים?',
    a: 'Anthropic Claude (Sonnet ליצירת קורות חיים, Haiku למשימות חילוץ זולות יותר). משתמשי Pro יוכלו לבחור את המודל.',
  },
  {
    q: 'איך עובד ניקוד ה-ATS?',
    a: 'אנחנו מחלצים מילות מפתח מתיאור המשרה, משווים עם קורות החיים שלך, ונותנים ציון 0-100. הכרטיס מציג מה התאים ומה חסר.',
  },
  {
    q: 'האם אפשר לערוך את קורות החיים אחרי שה-AI יצר אותם?',
    a: 'כן — פתח אותם מהדשבורד וערוך כל שדה. כל שמירה יוצרת גרסה חדשה, כך שאפשר לחזור אחורה.',
  },
  {
    q: 'יש תמיכה בעברית?',
    a: 'עברית היא השפה הראשית. הממשק, הפרומפטים של ה-AI, ותבניות ה-PDF מטפלים נכון ב-RTL. אנגלית בלחיצה אחת.',
  },
  {
    q: 'איך מבטלים מנוי?',
    a: 'הגדרות → חיוב → ניהול מנוי. הביטול מיידי (ממשיכים לגשת עד סוף התקופה).',
  },
  {
    q: 'האם פיצ׳ר חיפוש המשרות פעיל?',
    a: 'בביתא. התחבר, ופנה לתמיכה כדי להפעיל את הדגל לחשבונך.',
  },
];

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'faq' });
  const questions = locale === 'he' ? QUESTIONS_HE : QUESTIONS_EN;

  return (
    <div className="relative overflow-hidden">
      <AnimatedMeshBg intensity="subtle" />
      <div
        aria-hidden
        className="dark:from-background/40 dark:via-background/70 dark:to-background pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white"
      />
      <main className="relative mx-auto max-w-3xl px-4 py-12">
        <ScrollReveal>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </ScrollReveal>

        <div className="mt-8 space-y-3">
          {questions.map((item, i) => (
            <ScrollReveal key={i} delay={i * 0.04}>
              <details className="glass-subtle ease-smooth open:glass open:border-brand-300/50 dark:open:border-brand-700/50 group rounded-2xl p-4 transition-all duration-300">
                <summary className="cursor-pointer list-none font-medium">
                  <span className="text-brand-600 dark:text-brand-400 ease-snappy me-2 inline-block transition-transform duration-300 group-open:rotate-90">
                    ▶
                  </span>
                  {item.q}
                </summary>
                <p className="text-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
              </details>
            </ScrollReveal>
          ))}
        </div>

        <GlassPanel intensity="subtle" className="mt-12 p-6 text-center">
          <p className="text-sm">
            {locale === 'he' ? 'לא מצאת תשובה? ' : "Didn't find your answer? "}
            <a
              href={`/${locale}/contact`}
              className="text-brand-700 dark:text-brand-300 font-medium hover:underline"
            >
              {locale === 'he' ? 'פנה אלינו' : 'Contact us'}
            </a>
          </p>
        </GlassPanel>
      </main>
    </div>
  );
}
