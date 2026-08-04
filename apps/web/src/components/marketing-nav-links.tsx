'use client';

import { motion } from 'framer-motion';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Home/Examples/Pricing links for the signed-out marketing header.
 * Split out as its own client component (MarketingHeader itself is a
 * server component, for the session read) purely to get `usePathname`.
 *
 * The active link gets the same sliding glass pill as the signed-in
 * AppHeader's NavLink (a plain `bg-accent/60` color swap used to be
 * the whole "active" treatment here, which read as too subtle against
 * the header's own glass surface — barely distinguishable from hover).
 * Kept as its own `layoutId` namespace so it can't collide with the
 * app header's pill, even though the two never render at once.
 */
export function MarketingNavLinks({
  homeLabel,
  examplesLabel,
  pricingLabel,
  toolsLabel,
}: {
  homeLabel: string;
  examplesLabel: string;
  pricingLabel: string;
  toolsLabel: string;
}) {
  const pathname = usePathname();

  return (
    <>
      <NavLink href="/" active={pathname === '/'}>
        {homeLabel}
      </NavLink>
      <NavLink href="/examples" active={pathname === '/examples'}>
        {examplesLabel}
      </NavLink>
      <NavLink href="/pricing" active={pathname === '/pricing'}>
        {pricingLabel}
      </NavLink>
      {/* The free tools work with no account at all, which makes them
          the best top-of-funnel entry we have — but nothing linked to
          them from anywhere, so visitors only reached them by guessing
          the URL. `startsWith` so the two tool pages keep the header
          highlighted, not just the index. */}
      <NavLink href="/tools" active={pathname.startsWith('/tools')}>
        {toolsLabel}
      </NavLink>
    </>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: '/' | '/examples' | '/pricing' | '/tools';
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`ease-snappy group relative hidden rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 md:inline ${
        active
          ? 'text-brand-700 dark:text-brand-200'
          : 'text-foreground/80 hover:text-brand-700 dark:hover:text-brand-200'
      }`}
    >
      {/* Sliding active pill — shared `layoutId` across every NavLink
          instance means framer-motion animates it from the previous
          active link's position/size to this one instead of snapping. */}
      {active && (
        <motion.span
          layoutId="marketing-nav-active-pill"
          className="glass absolute inset-0 -z-10 rounded-full"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      {!active && (
        <span
          aria-hidden
          className="from-brand-500/0 via-brand-500/10 to-brand-500/0 absolute inset-0 -z-10 rounded-full bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
      {children}
    </Link>
  );
}
