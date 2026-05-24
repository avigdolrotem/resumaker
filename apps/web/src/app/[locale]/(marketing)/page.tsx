import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { ResumeMockup } from '@/components/resume-mockup';
import { ScrollReveal } from '@/components/scroll-reveal';
import { getProviderInfo } from '@/lib/billing/provider';
import {
  Sparkles,
  Target,
  Palette,
  Languages,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  Clipboard,
  Bot,
  Download,
  CheckCircle2,
  Mail,
  Github,
  Linkedin,
} from 'lucide-react';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const isHebrew = locale === 'he';
  const ArrowIcon = isHebrew ? ArrowLeft : ArrowRight;

  // Dynamic pricing CTA — when checkout is live ("get started" → /pricing
  // to choose interval). When PAYMENT_PROVIDER=none ("coming soon" →
  // /pricing → waitlist banner). The dedicated pricing page already
  // handles both modes; we just need to swap copy on the teaser.
  const checkoutReady = getProviderInfo().checkoutReady;
  const paidCta = checkoutReady
    ? isHebrew
      ? 'התחל עכשיו'
      : 'Get started'
    : isHebrew
      ? 'הצטרף לרשימת ההמתנה'
      : 'Join the waitlist';

  const features = [
    { key: 'ats' as const, Icon: Target, gradient: 'from-purple-500 to-pink-500' },
    { key: 'templates' as const, Icon: Palette, gradient: 'from-orange-500 to-red-500' },
    { key: 'rtl' as const, Icon: Languages, gradient: 'from-indigo-500 to-violet-500' },
    { key: 'secure' as const, Icon: ShieldCheck, gradient: 'from-emerald-500 to-teal-500' },
  ];

  const steps = isHebrew
    ? [
        { Icon: Clipboard, title: 'הדבק תיאור משרה', desc: 'הדבק טקסט או הוסף קישור למודעה' },
        { Icon: Bot, title: 'AI מייצר קורות חיים', desc: 'מותאם בדיוק לדרישות המשרה' },
        { Icon: Download, title: 'הורד PDF מותאם ATS', desc: 'מוכן לשליחה, מנוקד ומעוצב' },
      ]
    : [
        {
          Icon: Clipboard,
          title: 'Paste a job description',
          desc: 'Drop text or paste a job posting URL',
        },
        { Icon: Bot, title: 'AI generates your resume', desc: 'Tailored precisely to the role' },
        { Icon: Download, title: 'Download ATS-ready PDF', desc: 'Send-ready, scored, polished' },
      ];

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pb-32 pt-12 md:pt-20">
        <div
          aria-hidden
          className="from-brand-100/60 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-purple-100/40"
        />
        <div
          aria-hidden
          className="from-brand-400/30 to-brand-600/20 pointer-events-none absolute -top-40 start-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 end-0 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-pink-300/30 to-purple-400/20 blur-3xl"
        />

        <div className="container relative mx-auto grid items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-start">
            <ScrollReveal>
              <div className="border-brand-200 text-brand-700 inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="bg-brand-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-brand-500 relative inline-flex h-2 w-2 rounded-full" />
                </span>
                <Sparkles className="h-3 w-3" />
                {isHebrew ? 'מופעל על ידי Claude' : 'Powered by Claude AI'}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
                <span className="via-brand-700 to-brand-900 bg-gradient-to-br from-neutral-900 bg-clip-text text-transparent">
                  {t('hero.title')}
                </span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="mt-6 text-lg text-neutral-600 md:text-xl">{t('hero.subtitle')}</p>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
                <Link
                  href="/sign-up"
                  className="bg-brand-600 shadow-brand-500/20 hover:bg-brand-700 hover:shadow-brand-500/30 focus-visible:ring-brand-500 group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-md px-8 text-base font-medium text-white shadow-lg transition hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {t('hero.cta')}
                  <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </Link>
                <Link
                  href="/examples"
                  className="hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-500 inline-flex h-12 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-8 text-base font-medium text-neutral-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  <Palette className="h-4 w-4" />
                  {t('hero.secondaryCta')}
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-neutral-600 lg:justify-start">
                <TrustItem
                  Icon={Languages}
                  label={isHebrew ? 'תמיכה מלאה בעברית' : 'Hebrew RTL native'}
                />
                <TrustItem Icon={Target} label={isHebrew ? 'ניקוד ATS' : 'ATS scoring'} />
                <TrustItem
                  Icon={ShieldCheck}
                  label={isHebrew ? 'הצפנה מלאה' : 'End-to-end encrypted'}
                />
                <TrustItem Icon={Zap} label={isHebrew ? 'דקות לא שעות' : 'Seconds, not hours'} />
              </div>
            </ScrollReveal>
          </div>

          <div className="relative">
            <ResumeMockup locale={locale} />
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="border-y border-neutral-200 bg-white py-10">
        <div className="container mx-auto grid grid-cols-2 gap-6 px-4 md:grid-cols-4">
          <Stat value="48" suffix={isHebrew ? 'בדיקות אבטחה' : 'Safety tests'} />
          <Stat value="<3s" suffix={isHebrew ? 'יצירה ממוצעת' : 'Avg generation'} />
          <Stat value="5" suffix={isHebrew ? 'תבניות מעוצבות' : 'Custom templates'} />
          <Stat value="100%" suffix={isHebrew ? 'תמיכה בעברית' : 'Hebrew support'} />
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="bg-gradient-to-b from-neutral-50 to-white py-24">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                {isHebrew ? 'למה Resumaker?' : 'Why Resumaker'}
              </h2>
              <p className="mt-4 text-lg text-neutral-600">
                {isHebrew
                  ? 'הכלי היחיד שמשלב AI מתקדם עם דרישות השוק הישראלי'
                  : 'The only tool combining advanced AI with Israeli market expertise'}
              </p>
            </div>
          </ScrollReveal>

          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <ScrollReveal key={f.key} delay={i * 0.08}>
                <FeatureCard
                  Icon={f.Icon}
                  gradient={f.gradient}
                  title={t(`features.${f.key}.title`)}
                  description={t(`features.${f.key}.description`)}
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                {isHebrew ? 'איך זה עובד' : 'How it works'}
              </h2>
              <p className="mt-4 text-lg text-neutral-600">
                {isHebrew ? 'שלושה שלבים, מינוט אחד' : 'Three steps, one minute'}
              </p>
            </div>
          </ScrollReveal>

          <div className="relative mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div
              aria-hidden
              className="from-brand-200 via-brand-400 to-brand-200 absolute start-1/2 top-12 hidden h-0.5 w-2/3 -translate-x-1/2 bg-gradient-to-r md:block"
            />
            {steps.map((s, i) => (
              <ScrollReveal key={i} delay={i * 0.15}>
                <div className="relative">
                  <div className="from-brand-500 to-brand-700 shadow-brand-500/30 relative z-10 mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl">
                    <s.Icon className="h-10 w-10" />
                    <span className="text-brand-700 ring-brand-100 absolute -end-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold shadow-md ring-2">
                      {i + 1}
                    </span>
                  </div>
                  <div className="mt-6 text-center">
                    <h3 className="text-xl font-bold">{s.title}</h3>
                    <p className="mt-2 text-sm text-neutral-600">{s.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING TEASER ─── */}
      <section className="bg-neutral-50 py-24">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                {isHebrew ? 'מחירים פשוטים' : 'Simple pricing'}
              </h2>
              <p className="mt-4 text-lg text-neutral-600">
                {isHebrew ? 'התחל בחינם, שדרג מתי שתרצה' : 'Start free, upgrade when you want'}
              </p>
            </div>
          </ScrollReveal>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <PricingCard
              tier={isHebrew ? 'חינם' : 'Free'}
              price="₪0"
              period={isHebrew ? 'לתמיד' : 'forever'}
              features={
                isHebrew
                  ? ['2 קורות חיים בחודש', 'תבנית אחת', 'ניקוד ATS בסיסי', 'תמיכה בעברית']
                  : ['2 resumes/month', '1 template', 'Basic ATS scoring', 'Hebrew support']
              }
              cta={isHebrew ? 'התחל עכשיו' : 'Get started'}
              ctaHref="/sign-up"
              isHebrew={isHebrew}
            />
            <PricingCard
              tier={isHebrew ? 'פלוס' : 'Plus'}
              price="₪29"
              period={isHebrew ? 'לחודש' : 'per month'}
              features={
                isHebrew
                  ? ['עד 10 קורות חיים', '3 תבניות', 'ATS מלא + המלצות', 'ייבוא PDF', 'מכתבי הצעה']
                  : [
                      'Up to 10 resumes',
                      '3 templates',
                      'Full ATS + tips',
                      'PDF import',
                      'Cover letters',
                    ]
              }
              cta={paidCta}
              ctaHref="/pricing"
              featured
              badge={isHebrew ? 'הכי פופולרי' : 'Most popular'}
              isHebrew={isHebrew}
            />
            <PricingCard
              tier={isHebrew ? 'פרו' : 'Pro'}
              price="₪79"
              period={isHebrew ? 'לחודש' : 'per month'}
              features={
                isHebrew
                  ? [
                      'כל מה שיש בפלוס +',
                      'יצירות בלתי מוגבלות',
                      'היסטוריית גרסאות לתמיד',
                      'בחירת מודל AI',
                      'תמיכת VIP',
                    ]
                  : [
                      'Everything in Plus +',
                      'Unlimited generations',
                      'Unlimited version history',
                      'Choose your AI model',
                      'Priority support',
                    ]
              }
              cta={paidCta}
              ctaHref="/pricing"
              isHebrew={isHebrew}
            />
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="from-brand-600 via-brand-700 to-brand-900 relative overflow-hidden bg-gradient-to-br py-24 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 start-1/4 h-[400px] w-[400px] rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 end-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/20 blur-3xl"
        />
        <div className="container relative mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              {isHebrew ? 'הקריירה הבאה שלך מתחילה כאן' : 'Your next career starts here'}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-brand-100 mx-auto mt-4 max-w-xl text-lg">
              {isHebrew
                ? 'הרשמה חינם. בלי כרטיס אשראי. בלי התחייבות.'
                : 'Free to start. No credit card. No commitment.'}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="mt-10">
              <Link
                href="/sign-up"
                className="text-brand-700 hover:bg-brand-50 group inline-flex h-14 items-center gap-2 rounded-xl bg-white px-10 text-lg font-semibold shadow-2xl transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                {t('hero.cta')}
                <ArrowIcon className="h-5 w-5 transition group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-neutral-950 py-16 text-neutral-400">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="from-brand-300 to-brand-100 bg-gradient-to-br bg-clip-text text-xl font-bold text-transparent">
                Resumaker
              </h3>
              <p className="mt-2 text-sm">
                {isHebrew ? 'בונה קורות חיים מבוסס AI' : 'AI-powered resume builder'}
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://github.com/rotem/resumaker"
                  aria-label="GitHub"
                  className="transition hover:text-white"
                >
                  <Github className="h-5 w-5" />
                </a>
                <a
                  href="mailto:hello@resumaker.co.il"
                  aria-label="Email"
                  className="transition hover:text-white"
                >
                  <Mail className="h-5 w-5" />
                </a>
                <a
                  href="https://linkedin.com/in/rotemavigdol"
                  aria-label="LinkedIn"
                  className="transition hover:text-white"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
            <FooterColumn title={isHebrew ? 'מוצר' : 'Product'}>
              <FooterLink href="/examples">{isHebrew ? 'דוגמאות' : 'Examples'}</FooterLink>
              <FooterLink href="/sign-up">{isHebrew ? 'הרשמה' : 'Sign up'}</FooterLink>
              <FooterLink href="/sign-in">{isHebrew ? 'כניסה' : 'Sign in'}</FooterLink>
            </FooterColumn>
            <FooterColumn title={isHebrew ? 'משפטי' : 'Legal'}>
              <FooterLink href="/privacy">{isHebrew ? 'מדיניות פרטיות' : 'Privacy'}</FooterLink>
              <FooterLink href="/terms">{isHebrew ? 'תנאי שימוש' : 'Terms'}</FooterLink>
            </FooterColumn>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {isHebrew ? 'יצירת קשר' : 'Contact'}
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="mailto:hello@resumaker.co.il" className="transition hover:text-white">
                    hello@resumaker.co.il
                  </a>
                </li>
                <li>
                  <a href="mailto:privacy@resumaker.co.il" className="transition hover:text-white">
                    privacy@resumaker.co.il
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-neutral-800 pt-6 text-center text-xs">
            © 2026 Resumaker™ · {isHebrew ? 'כל הזכויות שמורות' : 'All rights reserved'} · BUSL-1.1
          </div>
        </div>
      </footer>
    </>
  );
}

function TrustItem({ Icon, label }: { Icon: typeof Sparkles; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="text-brand-600 h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

function Stat({ value, suffix }: { value: string; suffix: string }) {
  return (
    <div className="text-center">
      <div className="from-brand-600 to-brand-900 bg-gradient-to-br bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-xs text-neutral-600 md:text-sm">{suffix}</div>
    </div>
  );
}

function FeatureCard({
  Icon,
  gradient,
  title,
  description,
}: {
  Icon: typeof Sparkles;
  gradient: string;
  title: string;
  description: string;
}) {
  return (
    <div className="hover:shadow-brand-500/10 hover:border-brand-200 group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
      <div
        aria-hidden
        className={`absolute -end-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition group-hover:opacity-30 ${gradient}`}
      />
      <div
        className={`relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${gradient}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="relative text-lg font-semibold">{title}</h3>
      <p className="relative mt-2 text-sm text-neutral-600">{description}</p>
    </div>
  );
}

function PricingCard({
  tier,
  price,
  period,
  features,
  cta,
  ctaHref,
  featured,
  badge,
  isHebrew,
}: {
  tier: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  ctaHref: '/sign-up' | '/sign-in' | '/pricing';
  featured?: boolean;
  badge?: string;
  isHebrew: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-8 ${featured ? 'border-brand-300 to-brand-50 shadow-brand-500/10 bg-gradient-to-b from-white shadow-xl' : 'border-neutral-200 bg-white'}`}
    >
      {badge && (
        <div className="from-brand-600 to-brand-700 absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-white shadow-md">
          {badge}
        </div>
      )}
      <h3 className="text-lg font-semibold text-neutral-700">{tier}</h3>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight">{price}</span>
        <span className="text-sm text-neutral-500">{period}</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="text-brand-600 mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="text-neutral-700">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition ${featured ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md' : 'hover:border-brand-300 hover:bg-brand-50 border border-neutral-200 bg-white text-neutral-700'}`}
      >
        {cta}
        {featured &&
          (isHebrew ? (
            <ArrowLeft className="ms-2 h-4 w-4" />
          ) : (
            <ArrowRight className="ms-2 h-4 w-4" />
          ))}
      </Link>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: '/examples' | '/sign-up' | '/sign-in' | '/privacy' | '/terms';
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="transition hover:text-white">
        {children}
      </Link>
    </li>
  );
}
