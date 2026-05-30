'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
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
 * lopsided. Brand-coloured to stand out.
 */
export function NewMenu() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500 inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        <span>{t('new')}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="menu"
          className="border-border bg-card absolute end-0 z-50 mt-1 w-56 overflow-hidden rounded-md border shadow-lg"
        >
          <li role="none">
            <Link
              role="menuitem"
              href="/builder"
              onClick={() => setOpen(false)}
              className="hover:bg-muted flex items-center gap-2 px-3 py-2 text-sm"
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
              className="hover:bg-muted flex items-center gap-2 px-3 py-2 text-sm"
            >
              <Mail className="text-brand-500 h-4 w-4" />
              {t('newCoverLetter')}
            </Link>
          </li>
        </ul>
      )}
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
        className="bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 hover:ring-brand-300 focus-visible:ring-brand-500 inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold transition hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external OAuth image, sizes vary
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initials}</span>
        )}
      </button>
      {open && (
        <ul
          role="menu"
          className="border-border bg-card absolute end-0 z-50 mt-1 w-60 overflow-hidden rounded-md border shadow-lg"
        >
          <li className="border-border border-b px-3 py-2">
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
              className="hover:bg-muted flex items-center gap-2 px-3 py-2 text-sm"
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
              className="hover:bg-muted flex items-center gap-2 px-3 py-2 text-sm"
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
              className="hover:bg-muted flex items-center gap-2 px-3 py-2 text-sm"
            >
              <Settings className="h-4 w-4" />
              {t('settings')}
            </Link>
          </li>
          <li role="none" className="border-border border-t">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4" />
              {t('signOut')}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
