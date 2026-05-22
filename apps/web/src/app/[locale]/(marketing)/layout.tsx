import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
