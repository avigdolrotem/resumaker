/**
 * The synthetic URL an employer-posted job carries when the poster
 * didn't supply an external apply link.
 *
 * `jobs.url` is NOT NULL, so every row needs something. For a job posted
 * directly through the HR form there is no external posting to point at
 * — this app *is* where it was posted — so the column gets a placeholder
 * rather than a real destination.
 *
 * That placeholder must never be presented as a link. It was reaching
 * the job detail page as "View original posting", sending job-seekers to
 * a non-existent path on a domain unrelated to the running app. Writer
 * and reader both go through this file so the shape can't drift: change
 * the format here and detection follows automatically.
 */

const PREFIX = 'https://resumaker.co.il/jobs/hr-';

/**
 * Placeholder for an HR post with no external apply URL.
 *
 * Keyed on the JOB id, not the poster's. `jobs.url_normalized` is UNIQUE,
 * so a per-user placeholder made every posting by one recruiter collide
 * with their previous one — which is why a `#${Date.now()}` suffix was
 * bolted on, and why duplicate detection never worked: with a
 * millisecond-resolution suffix no two submissions ever match. A per-job
 * id is naturally unique, so the suffix isn't needed and the unique
 * index is free to do its actual job on real apply URLs.
 *
 * The prefix is unchanged, so isSyntheticHrUrl still recognises rows
 * written under the old scheme.
 */
export function hrPlaceholderUrl(jobId: string): string {
  return `${PREFIX}${jobId}`;
}

/**
 * True when this job's URL is our own placeholder rather than a real
 * destination — i.e. there is no "original posting" to link to.
 */
export function isSyntheticHrUrl(source: string, url: string | null | undefined): boolean {
  if (source !== 'hr' || !url) return false;
  return url.startsWith(PREFIX);
}
