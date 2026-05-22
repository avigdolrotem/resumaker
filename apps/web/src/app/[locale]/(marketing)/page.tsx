import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <section className="mx-auto max-w-4xl text-center">
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">{t('hero.title')}</h1>
        <p className="text-muted-foreground mt-6 text-xl md:text-2xl">{t('hero.subtitle')}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-12 items-center justify-center rounded-md px-8 text-base font-medium text-white shadow-lg transition"
          >
            {t('hero.cta')}
          </Link>
          <Link
            href="/templates"
            className="border-brand-200 text-brand-700 hover:bg-brand-50 inline-flex h-12 items-center justify-center rounded-md border bg-white px-8 text-base font-medium transition"
          >
            {t('hero.secondaryCta')}
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-4">
        {(['ats', 'templates', 'rtl', 'secure'] as const).map((key) => (
          <div key={key} className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h3 className="text-lg font-semibold">{t(`features.${key}.title`)}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{t(`features.${key}.description`)}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
