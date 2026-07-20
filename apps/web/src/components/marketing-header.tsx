import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import type { Locale } from '@/i18n/routing';
import { LocaleSwitcher } from './locale-switcher';
import { MarketingNavLinks } from './marketing-nav-links';
import { MarketingAuthCta } from './marketing-auth-cta';
import { GlowButton } from './ui-effects/glow-button';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { MobileDrawer } from './mobile-drawer';
import { ScrollHideHeader } from './scroll-hide-header';
import { UserAvatarMenu } from './app-header-menus';
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
    <ScrollHideHeader>
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

        <nav className="flex items-center gap-2 sm:gap-3">
          <MarketingNavLinks
            homeLabel={t('home')}
            examplesLabel={t('examples')}
            pricingLabel={t('pricing')}
          />
          <LocaleSwitcher />
          <ThemeToggle />

          {isAuthed ? (
            // Signed in: "Dashboard" CTA to jump back into the app, plus
            // the account avatar — previously the CTA swapping from
            // "Sign in/up" to "Dashboard" was the *only* signal of being
            // signed in, easy to miss since it reads as "a different
            // button" rather than unambiguously "you're logged in".
            // Same UserAvatarMenu the app header already uses (reads its
            // own session client-side, renders nothing when signed out)
            // — one consistent "this is you" affordance across both
            // shells instead of a marketing-only bespoke one.
            <>
              <GlowButton href="/dashboard" size="md">
                <LayoutDashboard className="h-4 w-4" />
                {t('dashboard')}
              </GlowButton>
              <UserAvatarMenu />
            </>
          ) : (
            // Sign-in is now the primary (glowing) CTA, sign-up the
            // secondary text link. Per user request — they're an
            // existing user testing repeatedly and sign-in is the
            // common-path action. Opens as an overlay (MarketingAuthCta)
            // rather than navigating — see auth-modal.tsx.
            <MarketingAuthCta signUpLabel={t('signUp')} signInLabel={t('signIn')} />
          )}
          <MobileDrawer />
        </nav>
      </header>
    </ScrollHideHeader>
  );
}
