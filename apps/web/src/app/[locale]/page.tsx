import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <section className="mx-auto max-w-4xl text-center">
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          {t('hero.title')}
        </h1>
        <p className="mt-6 text-xl text-muted-foreground md:text-2xl">
          {t('hero.subtitle')}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center justify-center rounded-md bg-brand-600 px-8 text-base font-medium text-white shadow-lg transition hover:bg-brand-700"
          >
            {t('hero.cta')}
          </Link>
          <Link
            href="/templates"
            className="inline-flex h-12 items-center justify-center rounded-md border border-brand-200 bg-white px-8 text-base font-medium text-brand-700 transition hover:bg-brand-50"
          >
            {t('hero.secondaryCta')}
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-4">
        {(['ats', 'templates', 'rtl', 'secure'] as const).map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{t(`features.${key}.title`)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(`features.${key}.description`)}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
