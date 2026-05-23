import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { Button } from './ui/button';
import { LocaleSwitcher } from './locale-switcher';

/**
 * Header for public marketing pages.
 *
 * Server component (no session check) so static pages stay light.
 * For authenticated pages use <AppHeader /> instead.
 */
export async function MarketingHeader({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="from-brand-600 to-brand-800 bg-gradient-to-br bg-clip-text text-2xl font-bold text-transparent"
        >
          Resumaker
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/examples"
            className="hover:text-brand-600 hidden text-sm font-medium text-neutral-700 transition sm:inline"
          >
            {t('home')}
          </Link>
          <LocaleSwitcher />
          <Link
            href="/sign-in"
            className="hover:text-brand-600 hidden text-sm font-medium text-neutral-700 transition sm:inline"
          >
            {t('signIn')}
          </Link>
          <Button asChild size="sm">
            <Link href="/sign-up">{t('signUp')}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
