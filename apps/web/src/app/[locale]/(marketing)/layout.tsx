import type { ReactNode } from 'react';
import { MarketingHeader } from '@/components/marketing-header';
import type { Locale } from '@/i18n/routing';

/**
 * Marketing pages must be dynamic so the header's session-aware CTA
 * (Dashboard for signed-in users vs Sign-in for guests) works on
 * every visit. Without this, Next.js may statically prerender the
 * page at build time — the build-time render has no cookies, so it
 * bakes in the signed-out CTA and signed-in users see Sign-in / Sign-up
 * even though their cookie is valid. Was reported visible on /en/examples
 * while /he/examples (rendered freshly on the user's session-bearing
 * request) showed the correct Dashboard CTA.
 */
export const dynamic = 'force-dynamic';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <>
      <MarketingHeader locale={locale} />
      <main id="main">{children}</main>
    </>
  );
}
