import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * /[locale]/legal/accessibility — accessibility statement.
 *
 * Compliance target: WCAG 2.1 AA. This page is required for Israeli
 * accessibility law (תקנות שוויון זכויות לאנשים עם מוגבלות) and good
 * practice for GDPR/Israeli Privacy Law.
 */
export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: 'he' | 'en' }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.accessibility' });

  return (
    <main className="prose mx-auto max-w-3xl px-4 py-12">
      <h1>{t('title')}</h1>
      <p className="text-neutral-600">{t('lastUpdated', { date: '2026-05-24' })}</p>

      <h2>{t('commitment.title')}</h2>
      <p>{t('commitment.body')}</p>

      <h2>{t('standards.title')}</h2>
      <p>{t('standards.body')}</p>
      <ul>
        <li>{t('standards.wcag')}</li>
        <li>{t('standards.israeliLaw')}</li>
      </ul>

      <h2>{t('features.title')}</h2>
      <ul>
        <li>{t('features.keyboard')}</li>
        <li>{t('features.contrast')}</li>
        <li>{t('features.rtl')}</li>
        <li>{t('features.focus')}</li>
        <li>{t('features.reducedMotion')}</li>
        <li>{t('features.screenReader')}</li>
      </ul>

      <h2>{t('known.title')}</h2>
      <p>{t('known.body')}</p>

      <h2>{t('contact.title')}</h2>
      <p>{t('contact.body')}</p>
      <p>
        <a href="mailto:accessibility@resumaker.co.il">accessibility@resumaker.co.il</a>
      </p>
    </main>
  );
}
