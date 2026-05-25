import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { ScrollReveal } from '@/components/scroll-reveal';
import { ArrowRight, ArrowLeft, DollarSign, FileSearch } from 'lucide-react';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'tools' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function ToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations('tools');
  const isHebrew = locale === 'he';
  const ArrowIcon = isHebrew ? ArrowLeft : ArrowRight;

  const tools = [
    {
      href: '/tools/salary-estimator' as const,
      Icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-500',
      titleKey: 'salaryEstimator.title' as const,
      descKey: 'salaryEstimator.description' as const,
    },
    {
      href: '/tools/ats-scanner' as const,
      Icon: FileSearch,
      gradient: 'from-purple-500 to-violet-500',
      titleKey: 'atsScanner.title' as const,
      descKey: 'atsScanner.description' as const,
    },
  ];

  return (
    <main id="main" className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <section className="container mx-auto max-w-4xl px-4 py-20">
        <ScrollReveal>
          <div className="mb-16 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t('title')}</h1>
            <p className="text-muted-foreground mt-4 text-lg">{t('subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className="grid gap-8 md:grid-cols-2">
          {tools.map(({ href, Icon, gradient, titleKey, descKey }, i) => (
            <ScrollReveal key={href} delay={i * 0.1}>
              <Link href={href}>
                <div className="hover:border-brand-200 hover:shadow-brand-500/10 border-border group cursor-pointer rounded-2xl border bg-white p-8 transition hover:-translate-y-1 hover:shadow-xl">
                  <div
                    className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${gradient}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold">{t(titleKey)}</h2>
                  <p className="text-muted-foreground mt-2">{t(descKey)}</p>
                  <span className="text-brand-700 group-hover:text-brand-900 mt-6 inline-flex items-center gap-1.5 text-sm font-medium">
                    {t('tryFree')}
                    <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </main>
  );
}
