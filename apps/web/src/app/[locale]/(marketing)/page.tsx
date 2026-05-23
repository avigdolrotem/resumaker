import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const isHebrew = locale === 'he';

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="via-brand-50/30 relative overflow-hidden bg-gradient-to-b from-white to-white pb-24 pt-16 md:pt-24">
        <div
          aria-hidden
          className="from-brand-400/30 to-brand-600/20 pointer-events-none absolute -top-40 start-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 end-0 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-blue-400/20 to-purple-400/20 blur-3xl"
        />

        <div className="container relative mx-auto px-4 text-center">
          <div className="border-brand-200 text-brand-700 mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="bg-brand-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-brand-500 relative inline-flex h-2 w-2 rounded-full" />
            </span>
            {isHebrew ? 'מופעל על ידי Claude' : 'Powered by Claude AI'}
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">
            <span className="via-brand-700 to-brand-900 bg-gradient-to-br from-neutral-900 bg-clip-text text-transparent">
              {t('hero.title')}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 md:text-xl">
            {t('hero.subtitle')}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-up"
              className="bg-brand-600 shadow-brand-500/20 hover:bg-brand-700 hover:shadow-brand-500/30 group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-md px-8 text-base font-medium text-white shadow-lg transition hover:shadow-xl"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {t('hero.cta')}
              <span aria-hidden>{isHebrew ? '←' : '→'}</span>
            </Link>
            <Link
              href="/examples"
              className="hover:border-brand-300 hover:bg-brand-50 inline-flex h-12 items-center justify-center rounded-md border border-neutral-200 bg-white px-8 text-base font-medium text-neutral-700 transition"
            >
              {t('hero.secondaryCta')}
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-neutral-500">
            <div className="flex items-center gap-2">
              <CheckIcon /> {isHebrew ? 'תמיכה מלאה בעברית' : 'Hebrew RTL native'}
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon /> {isHebrew ? 'ניקוד ATS' : 'ATS scoring'}
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon /> {isHebrew ? 'הצפנה מלאה' : 'End-to-end encrypted'}
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon /> {isHebrew ? 'ייצוא PDF' : 'PDF export'}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="bg-neutral-50 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {isHebrew ? 'למה Resumaker' : 'Why Resumaker'}
            </h2>
            <p className="mt-3 text-neutral-600">
              {isHebrew
                ? 'הכלי היחיד שמשלב AI מתקדם עם דרישות השוק הישראלי'
                : 'The only tool combining advanced AI with Israeli market expertise'}
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
            {(['ats', 'templates', 'rtl', 'secure'] as const).map((key, i) => (
              <FeatureCard
                key={key}
                icon={['📊', '🎨', '🇮🇱', '🔐'][i] ?? '✨'}
                title={t(`features.${key}.title`)}
                description={t(`features.${key}.description`)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {isHebrew ? 'איך זה עובד' : 'How it works'}
            </h2>
            <p className="mt-3 text-neutral-600">
              {isHebrew ? 'שלושה שלבים פשוטים' : 'Three simple steps'}
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {(isHebrew
              ? [
                  { n: 1, t: 'הדבק תיאור משרה', d: 'הדבק טקסט או הוסף קישור למודעה' },
                  { n: 2, t: 'AI מייצר קורות חיים', d: 'מותאם בדיוק לדרישות המשרה' },
                  { n: 3, t: 'הורד PDF', d: 'מוכן לשליחה, מותאם ATS' },
                ]
              : [
                  { n: 1, t: 'Paste a job description', d: 'Drop text or paste a job posting URL' },
                  { n: 2, t: 'AI generates your resume', d: 'Tailored precisely to the role' },
                  { n: 3, t: 'Download PDF', d: 'ATS-ready, send-ready' },
                ]
            ).map((s) => (
              <div key={s.n} className="relative">
                <div className="from-brand-500 to-brand-700 shadow-brand-500/20 absolute -top-3 start-0 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl font-bold text-white shadow-lg">
                  {s.n}
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 pt-10 shadow-sm">
                  <h3 className="text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="from-brand-600 to-brand-800 bg-gradient-to-br py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            {isHebrew ? 'מוכן להתחיל?' : 'Ready to get started?'}
          </h2>
          <p className="text-brand-100 mx-auto mt-3 max-w-xl">
            {isHebrew
              ? 'הרשמה חינם. אין צורך בכרטיס אשראי.'
              : 'Free to start. No credit card required.'}
          </p>
          <div className="mt-8">
            <Link
              href="/sign-up"
              className="text-brand-700 hover:bg-brand-50 inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-base font-medium shadow-lg transition"
            >
              {t('hero.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-neutral-950 py-12 text-neutral-400">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="text-lg font-bold text-white">Resumaker</h3>
              <p className="mt-2 text-sm">
                {isHebrew ? 'בונה קורות חיים מבוסס AI' : 'AI-powered resume builder'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{isHebrew ? 'מוצר' : 'Product'}</h4>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <Link href="/examples" className="hover:text-white">
                    {isHebrew ? 'דוגמאות' : 'Examples'}
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="hover:text-white">
                    {isHebrew ? 'הרשמה' : 'Sign up'}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{isHebrew ? 'משפטי' : 'Legal'}</h4>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    {isHebrew ? 'מדיניות פרטיות' : 'Privacy'}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white">
                    {isHebrew ? 'תנאי שימוש' : 'Terms'}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {isHebrew ? 'יצירת קשר' : 'Contact'}
              </h4>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <a href="mailto:hello@resumaker.co.il" className="hover:text-white">
                    hello@resumaker.co.il
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-neutral-800 pt-6 text-center text-xs">
            © 2026 Resumaker™ · All rights reserved
          </div>
        </div>
      </footer>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="hover:border-brand-300 hover:shadow-brand-500/5 group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-xl">
      <div
        aria-hidden
        className="from-brand-50 absolute inset-0 -translate-y-full bg-gradient-to-br to-transparent transition-transform duration-500 group-hover:translate-y-0"
      />
      <div className="relative">
        <div className="from-brand-100 to-brand-200 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="text-brand-600 h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
