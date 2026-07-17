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
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.dataRetention' });

  return (
    <div className="relative overflow-hidden py-12">
      {/* Static, non-animated wash — legal/compliance text needs
          stillness, not drifting blobs. Just enough atmosphere to
          match the rest of the site without competing with the
          reading experience. */}
      <div
        aria-hidden
        className="from-brand-50/50 via-background to-background dark:from-brand-950/20 pointer-events-none absolute inset-0 bg-gradient-to-b"
      />
      <main className="glass-subtle prose prose-neutral dark:prose-invert relative mx-auto max-w-3xl rounded-3xl px-6 py-10 sm:px-10 sm:py-12">
        <h1>{t('title')}</h1>
        <p className="text-muted-foreground">{t('lastUpdated', { date: '2026-05-24' })}</p>

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
    </div>
  );
}
