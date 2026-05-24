import type { ReactNode } from 'react';
import { MarketingHeader } from '@/components/marketing-header';
import type { Locale } from '@/i18n/routing';

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
