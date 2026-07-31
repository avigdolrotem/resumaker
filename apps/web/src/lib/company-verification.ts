/**
 * Company verification: does the owner's account-email domain match the
 * company's own claimed website? A lightweight, standard signal (the same
 * trust model Slack Connect and most B2B onboarding use) — it doesn't
 * prove identity, but it does stop the trivial case of posting as "Google"
 * while signed in with a personal Gmail account. Recomputed on company
 * create and on any websiteUrl update (see /api/hr/companies routes),
 * never user-settable directly.
 */
export function computeCompanyVerified(ownerEmail: string, websiteUrl: string | null): boolean {
  if (!websiteUrl) return false;

  const emailDomain = ownerEmail.split('@')[1]?.toLowerCase();
  if (!emailDomain) return false;

  let siteHost: string;
  try {
    siteHost = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (!siteHost) return false;

  // Allow a subdomain on either side (careers.company.com email or
  // website vs. a bare company.com on the other) — still exact-domain
  // trust, not a substring match.
  return (
    siteHost === emailDomain ||
    siteHost.endsWith(`.${emailDomain}`) ||
    emailDomain.endsWith(`.${siteHost}`)
  );
}
