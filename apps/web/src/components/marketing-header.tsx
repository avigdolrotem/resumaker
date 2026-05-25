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
    <header className="sticky top-0 z-40">
      <div
        className="border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/70 relative border-b backdrop-blur-xl"
        style={{
          // Same brand-tinted lift used in the app header — keeps both
          // shells visually consistent across signed-in / signed-out.
          boxShadow: 'inset 0 1px 0 hsl(252 75% 55% / 0.08), 0 1px 0 0 hsl(252 75% 55% / 0.04)',
        }}
      >
        {/* Brand-tinted gradient line at the bottom edge */}
        <div
          aria-hidden
          className="from-brand-500/0 via-brand-500/40 to-brand-500/0 absolute inset-x-0 bottom-0 h-px bg-gradient-to-r"
        />
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo size="md" href={isAuthed ? '/dashboard' : '/'} />

          {/* Desktop cmd+K trigger — center column, hidden on mobile
              where the hamburger drawer is the equivalent. */}
          <CommandPaletteTrigger className="mx-4 hidden max-w-xs flex-1 md:inline-flex" />

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/examples"
              className="text-foreground/80 hover:text-brand-700 dark:hover:text-brand-200 hidden rounded-md px-2 py-1 text-sm font-medium transition-colors md:inline"
            >
              {t('home')}
            </Link>
            <Link
              href="/pricing"
              className="text-foreground/80 hover:text-brand-700 dark:hover:text-brand-200 hidden rounded-md px-2 py-1 text-sm font-medium transition-colors md:inline"
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
              <>
                <Link
                  href="/sign-in"
                  className="text-foreground/80 hover:text-brand-700 dark:hover:text-brand-200 hidden rounded-md px-2 py-1 text-sm font-medium transition-colors md:inline"
                >
                  {t('signIn')}
                </Link>
                <GlowButton href="/sign-up" size="md">
                  {t('signUp')}
                </GlowButton>
              </>
            )}
            <MobileDrawer />
          </nav>
        </div>
      </div>
    </header>
  );
}
