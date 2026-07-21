/**
 * Derives the `resumes.title` column from jobTitle/companyName — the
 * column search/PDF-filename/version-history already key off, kept
 * as a stored fallback for resumes that predate (or whose extraction
 * failed to produce) a job_title/company_name pair.
 */
export function deriveResumeTitle(
  jobTitle: string | null | undefined,
  companyName: string | null | undefined,
  locale: 'he' | 'en' | 'ar' | 'ru',
): string {
  if (jobTitle && companyName) return `${jobTitle} — ${companyName}`;
  if (jobTitle) return jobTitle;
  if (companyName) return companyName;
  const fallback = locale === 'he' ? 'קורות חיים' : 'Resume';
  return `${fallback} — ${new Date().toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}`;
}
