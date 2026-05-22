'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { Button } from './ui/button';

export function SiteHeader() {
  const t = useTranslations('nav');
  const { data: session, isPending } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-brand-600 text-2xl font-bold">
          Resumaker
        </Link>

        <nav className="flex items-center gap-6">
          <LocaleSwitcher />

          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded bg-neutral-100" />
          ) : session ? (
            <>
              <Link
                href="/dashboard"
                className="hover:text-brand-600 text-sm font-medium text-neutral-700"
              >
                {t('dashboard')}
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                {t('signOut')}
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hover:text-brand-600 text-sm font-medium text-neutral-700"
              >
                {t('signIn')}
              </Link>
              <Button asChild size="sm">
                <Link href="/sign-up">{t('signUp')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
