import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { LocaleSwitcher } from './locale-switcher';
import { GlowButton } from './ui-effects/glow-button';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { CommandPaletteTrigger } from './command-palette';
import { MobileDrawer } from './mobile-drawer';
import { auth } from '@/lib/auth';
import { LayoutDashboard } from 'lucide-react';

/**
 * Header for public marketing pages.
 *
 * Server component. Reads the session so the CTA changes for signed-in
 * users — without this, an authenticated user navigating to /examples
 * (or any marketing page) saw "Sign in / Sign up" CTAs and felt like
 * they'd been signed out, even though the cookie was still valid.
 *
 * Modern aiapply-style:
 *  - Frosted-glass body with backdrop blur
 *  - Subtle gradient line at the bottom edge revealing brand color
 *  - Logo (icon + wordmark) with animated gradient on hover
 *  - GlowButton CTA — sign up for guests, "Dashboard" for members
 */
export async function MarketingHeader({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations('nav');
  // Best-effort session read — never blocks the marketing page render.
  // Wrapping in catch in case the cookie is malformed on first visit;
  // we'd rather show signed-out UI than 500 the marketing page.
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const isAuthed = Boolean(session);

  return (
    // Floating glass island, matching design-system/components/navigation.html
    // and the (app) header — same shell on both signed-in and signed-out
    // shells so the transition between them (e.g. marketing → dashboard)
    // doesn't feel like two different products.
    <div className="sticky top-3 z-40 mt-3 px-3 sm:top-4 sm:mt-4 sm:px-4">
      <header
        className="glass-strong relative mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full px-4"
        style={{
          // Blur capped at 16px, not the shadow-glass-lg token's 48px —
          // see the matching comment in app-header.tsx for why: past
          // ~24px, a rounded-full + backdrop-filter element's box-shadow
          // renders as a flat-edged rectangular smear in WebKit/Safari
          // instead of following the pill's curve (this was the white
          // glow users saw floating past the header on Safari).
          boxShadow: 'inset 0 1px 0 hsl(252 75% 90% / 0.35), 0 8px 16px hsl(260 55% 20% / 0.14)',
        }}
      >
        {/* Brand-tinted sheen along the top edge, inset past the pill's
            rounded corners. */}
        <div
          aria-hidden
          className="from-brand-500/0 via-brand-500/50 to-brand-500/0 pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r"
        />
        <Logo size="md" href={isAuthed ? '/dashboard' : '/'} />

        {/* Desktop cmd+K trigger — center column, hidden on mobile
            where the hamburger drawer is the equivalent. */}
        <CommandPaletteTrigger className="mx-4 hidden max-w-xs flex-1 md:inline-flex" />

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/examples"
            className="text-foreground/80 hover:text-brand-700 hover:bg-accent/60 dark:hover:text-brand-200 ease-snappy hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 md:inline"
          >
            {t('home')}
          </Link>
          <Link
            href="/pricing"
            className="text-foreground/80 hover:text-brand-700 hover:bg-accent/60 dark:hover:text-brand-200 ease-snappy hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 md:inline"
          >
            {t('pricing')}
          </Link>
          <LocaleSwitcher />
          <ThemeToggle />

          {isAuthed ? (
            // Signed in: show "Dashboard" CTA so the user knows they
            // can jump back into the app from any marketing page. No
            // duplicate "Sign in" / "Sign up" links (those are for
            // anonymous visitors only).
            <GlowButton href="/dashboard" size="md">
              <LayoutDashboard className="h-4 w-4" />
              {t('dashboard')}
            </GlowButton>
          ) : (
            // Sign-in is now the primary (glowing) CTA, sign-up the
            // secondary text link. Per user request — they're an
            // existing user testing repeatedly and sign-in is the
            // common-path action.
            <>
              <Link
                href="/sign-up"
                className="text-foreground/80 hover:text-brand-700 hover:bg-accent/60 dark:hover:text-brand-200 ease-snappy hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 md:inline"
              >
                {t('signUp')}
              </Link>
              <GlowButton href="/sign-in" size="md">
                {t('signIn')}
              </GlowButton>
            </>
          )}
          <MobileDrawer />
        </nav>
      </header>
    </div>
  );
}
