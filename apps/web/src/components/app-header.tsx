'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import { LayoutDashboard, Settings, Mail, Briefcase, TrendingUp } from 'lucide-react';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { CommandPaletteTrigger } from './command-palette';
import { MobileDrawer } from './mobile-drawer';
import { Button } from './ui/button';
import { NewMenu, UserAvatarMenu } from './app-header-menus';

/**
 * Header for authenticated app pages.
 * Client component (needs useSession + sign-out handler).
 */
export function AppHeader() {
  const t = useTranslations('nav');
  const { data: session, isPending } = useSession();

  return (
    <header
      className="border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{
        // Subtle brand gradient at the very top — invisible-ish in light
        // mode (a hair of violet), more noticeable in dark mode where
        // it adds depth to an otherwise flat surface.
        boxShadow: 'inset 0 1px 0 hsl(252 75% 55% / 0.08), 0 1px 0 0 hsl(252 75% 55% / 0.04)',
      }}
    >
      {/* Animated brand-tinted glow bar at the bottom edge — adds
          life to the header without being noisy. Only renders if
          motion is allowed (respects prefers-reduced-motion via the
          underlying CSS). */}
      <div
        aria-hidden
        className="from-brand-500/0 via-brand-500/40 to-brand-500/0 absolute inset-x-0 bottom-0 h-px bg-gradient-to-r"
      />
      <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
        <Logo size="md" href="/dashboard" />

        {/* Center: command-palette trigger. Desktop only — mobile gets
            the cmd+K via the drawer's first item. */}
        <CommandPaletteTrigger className="mx-4 hidden max-w-xs flex-1 md:inline-flex" />

        <nav className="flex items-center gap-1">
          {/* Desktop nav links — md+. Icon-only on md, icon+label on lg+. */}
          <NavLink
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label={t('dashboard')}
          />
          {/* "+ New" dropdown consolidates the create actions
              (resume + cover letter) — replaces the old standalone
              Builder NavLink, which got lopsided once cover letters
              joined. Sits as the first action after Dashboard so it's
              the most prominent CTA. */}
          <div className="hidden md:flex md:items-center">
            <NewMenu />
          </div>
          {/* Cover Letters — sits between New and Jobs in the
              canonical top-bar order. Renders only when signed in
              (this is the (app) header). */}
          <NavLink
            href="/cover-letters"
            icon={<Mail className="h-4 w-4" />}
            label={t('coverLetters')}
          />
          <NavLink href="/jobs" icon={<Briefcase className="h-4 w-4" />} label={t('jobs')} />
          <NavLink
            href="/applications"
            icon={<TrendingUp className="h-4 w-4" />}
            label={t('applications')}
          />
          <NavLink href="/settings" icon={<Settings className="h-4 w-4" />} label={t('settings')} />

          {/* Divider only when desktop nav items are visible */}
          <div className="bg-border mx-2 hidden h-6 w-px md:block" />

          {/* Locale + theme: desktop only. Both are available in the
              mobile drawer. Keeps the mobile bar uncluttered so the
              burger has room. */}
          <div className="hidden md:flex md:items-center md:gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>

          {/* Account — desktop only. Drawer has the same actions on mobile.
              Avatar dropdown consolidates Profile / Billing / Settings /
              Sign out under one affordance — less header chrome than the
              old name-link + standalone sign-out button pair. */}
          <div className="hidden md:flex md:items-center md:gap-2">
            {isPending ? (
              <div className="bg-muted ms-2 h-9 w-9 animate-pulse rounded-full" />
            ) : session ? (
              <UserAvatarMenu />
            ) : (
              <Button asChild size="sm" variant="outline" className="ms-2">
                <Link href="/sign-in">{t('signIn')}</Link>
              </Button>
            )}
          </div>

          {/* Mobile burger — always visible on < md. The drawer has
              every nav item + theme + locale + profile + sign-out. */}
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
  href: '/dashboard' | '/builder' | '/cover-letters' | '/jobs' | '/applications' | '/settings';
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="text-foreground/80 hover:text-brand-700 dark:hover:text-brand-200 group relative hidden items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors md:inline-flex"
    >
      {/* Soft brand-tinted hover background that fades in on hover —
          replaces the flat hover:bg-brand-50 with something that
          plays nicer with dark themes. */}
      <span
        aria-hidden
        className="from-brand-500/0 via-brand-500/10 to-brand-500/0 absolute inset-0 -z-10 rounded-md bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100"
      />
      <span className="text-brand-500 group-hover:text-brand-600 dark:text-brand-400 dark:group-hover:text-brand-300 transition-colors">
        {icon}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
