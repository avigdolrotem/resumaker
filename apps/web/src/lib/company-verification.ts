/**
 * Free/personal email providers — never eligible as a "company domain"
 * match, no matter what websiteUrl claims. Without this, setting
 * websiteUrl to e.g. https://gmail.com while signed in with any
 * @gmail.com address would satisfy the domain-match check below (both
 * sides literally are "gmail.com"), handing out a false verified=true
 * to anyone — the exact case this whole check exists to prevent, just
 * approached from the other direction (nobody's *company* is gmail.com,
 * but the naive match doesn't know that). Israeli ISP/portal webmail
 * domains included since this is an Israel-first product and the same
 * bypass applies to them.
 */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.il',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'walla.co.il',
  'walla.com',
  '012.net.il',
  'netvision.net.il',
  'bezeqint.net',
  '013.net',
]);

/**
 * Company verification: does the owner's account-email domain match the
 * company's own claimed website? A lightweight, standard signal (the same
 * trust model Slack Connect and most B2B onboarding use) — it doesn't
 * prove identity, but it does stop the trivial case of posting as "Google"
 * while signed in with a personal Gmail account, *and* the inverse case
 * of setting websiteUrl to a free email provider's own domain to farm a
 * false match (see FREE_EMAIL_DOMAINS above). Recomputed on company
 * create and on any websiteUrl update (see /api/hr/companies routes),
 * never user-settable directly.
 */
export function computeCompanyVerified(ownerEmail: string, websiteUrl: string | null): boolean {
  if (!websiteUrl) return false;

  const emailDomain = ownerEmail.split('@')[1]?.toLowerCase();
  if (!emailDomain) return false;
  if (FREE_EMAIL_DOMAINS.has(emailDomain)) return false;

  let siteHost: string;
  try {
    siteHost = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  if (!siteHost) return false;
  if (FREE_EMAIL_DOMAINS.has(siteHost)) return false;

  // Allow a subdomain on either side (careers.company.com email or
  // website vs. a bare company.com on the other) — still exact-domain
  // trust, not a substring match.
  return (
    siteHost === emailDomain ||
    siteHost.endsWith(`.${emailDomain}`) ||
    emailDomain.endsWith(`.${siteHost}`)
  );
}
