import type { ReactNode } from 'react';
import { MarketingHeader } from '@/components/marketing-header';
import type { Locale } from '@/i18n/routing';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return (
    <>
      <MarketingHeader locale={locale} />
      <main id="main">{children}</main>
    </>
  );
}
