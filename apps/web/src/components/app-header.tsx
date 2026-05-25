'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { LayoutDashboard, FilePlus2, Settings, LogOut, UserCircle } from 'lucide-react';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { CommandPaletteTrigger } from './command-palette';
import { MobileDrawer } from './mobile-drawer';
import { Button } from './ui/button';

/**
 * Header for authenticated app pages.
 * Client component (needs useSession + sign-out handler).
 */
export function AppHeader() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { data: session, isPending } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo size="md" href="/dashboard" />

        {/* Center column: command-palette trigger replaces the old
            horizontal nav links on desktop. The pill is more
            discoverable + supports keyboard nav (⌘K). The old
            individual nav buttons are still there for muscle memory
            but reduced visually. */}
        <CommandPaletteTrigger className="mx-4 hidden max-w-xs flex-1 md:inline-flex" />

        <nav className="flex items-center gap-1">
          <NavLink
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label={t('dashboard')}
          />
          <NavLink
            href="/builder"
            icon={<FilePlus2 className="h-4 w-4" />}
            label={t('newResume')}
          />
          <NavLink href="/settings" icon={<Settings className="h-4 w-4" />} label={t('settings')} />

          <div className="bg-border mx-2 hidden h-6 w-px md:block" />

          <LocaleSwitcher />
          <ThemeToggle />

          {isPending ? (
            <div className="ms-2 h-8 w-20 animate-pulse rounded bg-neutral-100" />
          ) : session ? (
            <div className="ms-2 flex items-center gap-2">
              <Link
                href="/profile"
                className="hover:text-brand-700 hover:bg-brand-50 hidden items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 transition lg:inline-flex"
              >
                <UserCircle className="h-4 w-4" />
                <span className="max-w-[140px] truncate">{session.user.name}</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} title={t('signOut')}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" variant="outline" className="ms-2">
              <Link href="/sign-in">{t('signIn')}</Link>
            </Button>
          )}
          <MobileDrawer />
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: '/dashboard' | '/builder' | '/settings';
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="text-foreground hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-100 hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition md:inline-flex"
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
