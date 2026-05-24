import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * /[locale]/legal/data-retention — public data retention policy.
 *
 * Mirrors what the code actually does (the purge cron deletes
 * soft-deleted users + their cascaded data after 30 days; audit log
 * trimmed after 1 year; sessions expire 14 days; etc).
 */
export default async function DataRetentionPage({
  params,
}: {
  params: Promise<{ locale: 'he' | 'en' }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.dataRetention' });

  return (
    <main className="prose mx-auto max-w-3xl px-4 py-12">
      <h1>{t('title')}</h1>
      <p className="text-neutral-600">{t('lastUpdated', { date: '2026-05-24' })}</p>

      <h2>{t('overview.title')}</h2>
      <p>{t('overview.body')}</p>

      <h2>{t('table.title')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('table.dataType')}</th>
            <th>{t('table.duration')}</th>
            <th>{t('table.basis')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t('rows.profile.type')}</td>
            <td>{t('rows.profile.duration')}</td>
            <td>{t('rows.profile.basis')}</td>
          </tr>
          <tr>
            <td>{t('rows.resumes.type')}</td>
            <td>{t('rows.resumes.duration')}</td>
            <td>{t('rows.resumes.basis')}</td>
          </tr>
          <tr>
            <td>{t('rows.coverLetters.type')}</td>
            <td>{t('rows.coverLetters.duration')}</td>
            <td>{t('rows.coverLetters.basis')}</td>
          </tr>
          <tr>
            <td>{t('rows.sessions.type')}</td>
            <td>{t('rows.sessions.duration')}</td>
            <td>{t('rows.sessions.basis')}</td>
          </tr>
          <tr>
            <td>{t('rows.audit.type')}</td>
            <td>{t('rows.audit.duration')}</td>
            <td>{t('rows.audit.basis')}</td>
          </tr>
          <tr>
            <td>{t('rows.softDeleted.type')}</td>
            <td>{t('rows.softDeleted.duration')}</td>
            <td>{t('rows.softDeleted.basis')}</td>
          </tr>
        </tbody>
      </table>

      <h2>{t('rights.title')}</h2>
      <p>{t('rights.body')}</p>
    </main>
  );
}
