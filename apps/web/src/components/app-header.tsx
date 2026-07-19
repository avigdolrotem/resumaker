'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Link, usePathname } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import { LayoutDashboard, Settings, Mail, Briefcase, TrendingUp, FileText } from 'lucide-react';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { CommandPaletteTrigger } from './command-palette';
import { MobileDrawer } from './mobile-drawer';
import { ScrollHideHeader } from './scroll-hide-header';
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
    // ScrollHideHeader owns the sticky positioning + viewport offset —
    // the header itself floats as a detached glass island (per design-
    // system/components/navigation.html) rather than docking edge-to-
    // edge like a conventional bar, and slides out of the way on
    // scroll-down so it doesn't sit on top of content on long pages.
    <ScrollHideHeader>
      <header
        className="glass-strong relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 rounded-full px-4"
        style={{
          // Inner top highlight (glass "sheen") + a soft ambient drop
          // shadow so the pill visibly lifts off the page instead of
          // reading as a flat rounded box. Blur capped at 16px — a
          // rounded-full element with backdrop-filter AND a box-shadow
          // blurred past ~24px renders as a flat-edged rectangular smear
          // in WebKit/Safari instead of following the pill's curve
          // (confirmed via webkit-engine screenshots at 12/20/34px; 34px
          // — the original value — was the "shallow rectangle" users
          // saw floating past the header on Safari). This is also why
          // shadow-glass-lg isn't used here despite being the standard
          // elevation token: its 48px blur is well past the safe range.
          // Not otherwise a risk on rounded-2xl surfaces (cards, modals)
          // — their natural shape is close enough to the blur's own
          // falloff that the clipping error isn't visible; specific to
          // rounded-full pills like this header.
          boxShadow: 'inset 0 1px 0 hsl(252 75% 90% / 0.35), 0 8px 16px hsl(260 55% 20% / 0.14)',
        }}
      >
        {/* Brand-tinted sheen along the top edge, inset past the pill's
            rounded corners so it doesn't poke outside the curve. */}
        <div
          aria-hidden
          className="from-brand-500/0 via-brand-500/50 to-brand-500/0 pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r"
        />
        <Logo size="md" href="/dashboard" />

        {/* "+ New" sits to the left of the search bar, not among the
            plain nav links — it's the one filled/brand-colored button
            in the header, so grouping it with the flat text links (its
            old spot, right after Dashboard) made it look like a stray
            mis-styled link rather than a primary CTA. Left of search
            mirrors how Linear/Vercel place their primary "create"
            action: right next to the logo, ahead of navigation. */}
        <div className="hidden md:flex md:items-center">
          <NewMenu />
        </div>

        {/* Center: command-palette trigger. Desktop only — mobile gets
            the cmd+K via the drawer's first item. */}
        <CommandPaletteTrigger className="mx-4 hidden max-w-xs flex-1 md:inline-flex" />

        <nav className="flex items-center gap-1">
          {/* Desktop nav links — md+. Icon-only on md, icon+label on lg+.
              `pathname` drives the shared-layout sliding pill (see
              NavLink below) — framer-motion's `layoutId` animates the
              pill from the previous active link to the new one instead
              of it just popping into place. */}
          <NavLink
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label={t('dashboard')}
          />
          {/* Resumes — previously had no nav entry anywhere at all (not
              missing from just this header — the route itself didn't
              exist). The only way to reach a saved resume was scrolling
              the dashboard's 6-most-recent widget and clicking one
              directly; nothing surfaced resumes past that. */}
          <NavLink href="/resumes" icon={<FileText className="h-4 w-4" />} label={t('myResumes')} />
          {/* Cover Letters — sits between Resumes and Jobs in the
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
          <div className="bg-border/60 mx-2 hidden h-6 w-px md:block" />

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
      </header>
    </ScrollHideHeader>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href:
    | '/dashboard'
    | '/builder'
    | '/resumes'
    | '/cover-letters'
    | '/jobs'
    | '/applications'
    | '/settings';
  icon: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="text-foreground/80 hover:text-brand-700 dark:hover:text-brand-200 group relative hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors md:inline-flex"
    >
      {/* Sliding active pill — same `layoutId` shared across every
          NavLink instance means framer-motion animates it from the
          previous active link's position/size to this one instead of
          snapping, whenever `active` flips true here. Glass surface so
          it reads as "liquid" rather than a flat highlight. */}
      {active && (
        <motion.span
          layoutId="app-nav-active-pill"
          className="glass absolute inset-0 -z-10 rounded-full"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      {/* Soft brand-tinted hover background — only for the inactive
          state, so it doesn't fight with the active pill above. */}
      {!active && (
        <span
          aria-hidden
          className="from-brand-500/0 via-brand-500/10 to-brand-500/0 absolute inset-0 -z-10 rounded-full bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
      <span
        className={
          active
            ? 'text-brand-600 dark:text-brand-300 transition-colors'
            : 'text-brand-500 group-hover:text-brand-600 dark:text-brand-400 dark:group-hover:text-brand-300 transition-colors'
        }
      >
        {icon}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
