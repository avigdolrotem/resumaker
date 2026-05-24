import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { LocaleSwitcher } from './locale-switcher';
import { GlowButton } from './ui-effects/glow-button';

/**
 * Header for public marketing pages.
 *
 * Server component (no session check) so static pages stay light.
 * For authenticated pages use <AppHeader /> instead.
 *
 * Modern aiapply-style header:
 *  - True glass effect with backdrop-blur (more frosted than before)
 *  - Subtle bottom-edge gradient line that reveals the brand color
 *  - Animated wordmark on hover (gradient shifts)
 *  - GlowButton CTA so the primary action draws the eye
 */
export async function MarketingHeader({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-40">
      {/* Glass body */}
      <div className="relative border-b border-white/40 bg-white/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
        {/* Subtle gradient line at the bottom edge */}
        <div
          aria-hidden
          className="via-brand-300/50 absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent"
        />
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className="group relative text-2xl font-bold tracking-tight"
            aria-label="Resumaker home"
          >
            <span className="from-brand-700 via-brand-500 to-brand-700 bg-gradient-to-r bg-[length:200%_100%] bg-clip-text text-transparent transition-[background-position] duration-500 group-hover:bg-right">
              Resumaker
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-5">
            <Link
              href="/examples"
              className="hover:bg-brand-50 hover:text-brand-700 hidden rounded-md px-2 py-1 text-sm font-medium text-neutral-700 transition sm:inline"
            >
              {t('home')}
            </Link>
            <Link
              href="/pricing"
              className="hover:bg-brand-50 hover:text-brand-700 hidden rounded-md px-2 py-1 text-sm font-medium text-neutral-700 transition sm:inline"
            >
              {t('pricing')}
            </Link>
            <LocaleSwitcher />
            <Link
              href="/sign-in"
              className="hover:bg-brand-50 hover:text-brand-700 hidden rounded-md px-2 py-1 text-sm font-medium text-neutral-700 transition sm:inline"
            >
              {t('signIn')}
            </Link>
            <GlowButton href="/sign-up" size="md">
              {t('signUp')}
            </GlowButton>
          </nav>
        </div>
      </div>
    </header>
  );
}
