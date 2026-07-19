'use client';

import { Link, usePathname } from '@/i18n/navigation';

/**
 * Home/Pricing links for the signed-out marketing header. Split out as
 * its own client component (MarketingHeader itself is a server
 * component, for the session read) purely to get `usePathname` — the
 * signed-in AppHeader already highlights whichever page you're on via
 * its NavLink; these links had no equivalent, so a visitor on /pricing
 * saw "Pricing" styled identically to "Home" with no indication of
 * where they were.
 */
export function MarketingNavLinks({
  homeLabel,
  pricingLabel,
}: {
  homeLabel: string;
  pricingLabel: string;
}) {
  const pathname = usePathname();

  return (
    <>
      <NavLink href="/examples" active={pathname === '/examples'}>
        {homeLabel}
      </NavLink>
      <NavLink href="/pricing" active={pathname === '/pricing'}>
        {pricingLabel}
      </NavLink>
    </>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: '/examples' | '/pricing';
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`ease-snappy hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 md:inline ${
        active
          ? 'text-brand-700 dark:text-brand-200 bg-accent/60'
          : 'text-foreground/80 hover:text-brand-700 hover:bg-accent/60 dark:hover:text-brand-200'
      }`}
    >
      {children}
    </Link>
  );
}
