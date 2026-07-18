'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  CreditCard,
  FilePlus2,
  LogOut,
  Mail,
  Plus,
  Settings,
  UserCircle,
} from 'lucide-react';

// Shared spring + panel treatment for both dropdowns below — same
// values as the command palette's active-row indicator and the
// upgrade modal, so every "thing that pops open" in the app feels
// like the same material.
const MENU_SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const;
const menuItemClass =
  'ease-smooth flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-200 hover:bg-accent/50';

/**
 * Shared bits for the two header dropdowns. Both `NewMenu` and
 * `UserAvatarMenu` follow the same lightweight pattern as
 * `ModelPicker` (outside-click + Escape close), so we avoid pulling in
 * a popover library just for two menus.
 */
function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/**
 * "+ New ▾" header CTA. Consolidates the two create actions (resume +
 * cover letter) under one prominent button — the resume builder used
 * to be a top-level NavLink, but adding cover letters made the nav
 * lopsided. Brand-coloured to stand out. Sits just right of the logo
 * (left of the search bar) — see the comment at its call site in
 * app-header.tsx for why.
 */
export function NewMenu() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4" />
        <span>{t('new')}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={MENU_SPRING}
            // start-0 (not end-0, unlike UserAvatarMenu) — this button
            // now lives right after the logo near the header's start
            // edge, so anchoring the menu's end edge would swing it
            // toward the outside of the pill instead of into the
            // header's open space.
            className="glass-strong shadow-glass-lg absolute start-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl p-1.5"
          >
            <li role="none">
              <Link
                role="menuitem"
                href="/builder"
                onClick={() => setOpen(false)}
                className={menuItemClass}
              >
                <FilePlus2 className="text-brand-500 h-4 w-4" />
                {t('newResume')}
              </Link>
            </li>
            <li role="none">
              <Link
                role="menuitem"
                href="/cover-letters/new"
                onClick={() => setOpen(false)}
                className={menuItemClass}
              >
                <Mail className="text-brand-500 h-4 w-4" />
                {t('newCoverLetter')}
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Avatar + dropdown menu (Profile / Billing / Settings / Sign out).
 * Replaces the previous "name link + standalone sign-out button" pair
 * — same actions, less header real-estate, more obvious affordance.
 *
 * Uses the user's `image` if Better Auth populated it (OAuth signups),
 * otherwise falls back to initials derived from `name`.
 */
export function UserAvatarMenu() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));

  if (!session) return null;

  const name = session.user.name ?? '';
  const image = session.user.image ?? null;
  const initials =
    name
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name || t('account')}
        className="bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 hover:ring-brand-300 focus-visible:ring-brand-500 ease-smooth inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold transition-all duration-200 hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external OAuth image, sizes vary
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={MENU_SPRING}
            className="glass-strong shadow-glass-lg absolute end-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl p-1.5"
          >
            <li className="border-border/60 mb-1 border-b px-3 py-2">
              <p className="truncate text-sm font-medium">{name || t('account')}</p>
              <p className="text-muted-foreground truncate text-xs" dir="ltr">
                {session.user.email}
              </p>
            </li>
            <li role="none">
              <Link
                role="menuitem"
                href="/profile"
                onClick={() => setOpen(false)}
                className={menuItemClass}
              >
                <UserCircle className="h-4 w-4" />
                {t('profile')}
              </Link>
            </li>
            <li role="none">
              <Link
                role="menuitem"
                href="/account/billing"
                onClick={() => setOpen(false)}
                className={menuItemClass}
              >
                <CreditCard className="h-4 w-4" />
                {t('billing')}
              </Link>
            </li>
            <li role="none">
              <Link
                role="menuitem"
                href="/settings"
                onClick={() => setOpen(false)}
                className={menuItemClass}
              >
                <Settings className="h-4 w-4" />
                {t('settings')}
              </Link>
            </li>
            <li role="none" className="border-border/60 mt-1 border-t pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="ease-smooth flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors duration-200 hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                {t('signOut')}
              </button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
