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

/** Placeholder for an HR post with no external apply URL. */
export function hrPlaceholderUrl(userId: string): string {
  return `${PREFIX}${userId}`;
}

/**
 * True when this job's URL is our own placeholder rather than a real
 * destination — i.e. there is no "original posting" to link to.
 */
export function isSyntheticHrUrl(source: string, url: string | null | undefined): boolean {
  if (source !== 'hr' || !url) return false;
  return url.startsWith(PREFIX);
}
