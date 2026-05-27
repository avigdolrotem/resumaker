'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  FilePlus2,
  Settings,
  UserCircle,
  LogIn,
  UserPlus,
  Briefcase,
  Mail,
  Home,
  CreditCard,
  Palette,
  TrendingUp,
  LogOut,
  Shield,
  ScrollText,
  Accessibility,
  Archive,
  MessageSquare,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from '@/i18n/navigation';
import { Logo } from './logo';

/**
 * Mobile-only sliding drawer with primary nav. On viewports < md we hide
 * the horizontal pill nav and show only a hamburger button; tapping it
 * slides this drawer in from the trailing edge (RTL-aware via `inset-end`).
 *
 * Backdrop click + Escape close the drawer. Body scroll locks while open
 * so the page underneath doesn't shift around.
 *
 * Hidden on md+ via `md:hidden` — desktop users see the pill nav instead.
 */
type LinkHref =
  | '/dashboard'
  | '/builder'
  | '/cover-letters'
  | '/cover-letters/new'
  | '/applications'
  | '/jobs'
  | '/settings'
  | '/profile'
  | '/account/billing'
  | '/examples'
  | '/pricing'
  | '/'
  | '/sign-in'
  | '/sign-up'
  | '/contact'
  | '/privacy'
  | '/terms'
  | '/legal/accessibility'
  | '/legal/data-retention';

type Item =
  | { kind: 'link'; href: LinkHref; label: string; Icon: typeof Menu }
  | { kind: 'divider'; label: string }
  | { kind: 'action'; action: 'sign-out'; label: string; Icon: typeof Menu };

/**
 * Legal links visible to BOTH signed-in and signed-out users. Required
 * to be reachable from every page under Israeli accessibility law
 * (חוק שוויון זכויות לאנשים עם מוגבלות) — the accessibility statement
 * in particular must have a clear link, including from inside the
 * authed app shell.
 */
const legalItems: Item[] = [
  { kind: 'divider', label: 'Legal' },
  { kind: 'link', href: '/contact', label: 'Contact', Icon: MessageSquare },
  { kind: 'link', href: '/privacy', label: 'Privacy', Icon: Shield },
  { kind: 'link', href: '/terms', label: 'Terms', Icon: ScrollText },
  { kind: 'link', href: '/legal/accessibility', label: 'Accessibility', Icon: Accessibility },
  { kind: 'link', href: '/legal/data-retention', label: 'Data retention', Icon: Archive },
];

function authedItems(): Item[] {
  return [
    { kind: 'link', href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { kind: 'link', href: '/builder', label: 'New resume', Icon: FilePlus2 },
    { kind: 'link', href: '/cover-letters', label: 'Cover letters', Icon: Mail },
    { kind: 'link', href: '/applications', label: 'Applications', Icon: TrendingUp },
    { kind: 'link', href: '/jobs', label: 'Job hunt', Icon: Briefcase },
    { kind: 'link', href: '/examples', label: 'Examples', Icon: Palette },
    { kind: 'link', href: '/profile', label: 'Profile', Icon: UserCircle },
    { kind: 'link', href: '/settings', label: 'Settings', Icon: Settings },
    { kind: 'link', href: '/account/billing', label: 'Billing', Icon: CreditCard },
    ...legalItems,
    { kind: 'action', action: 'sign-out', label: 'Sign out', Icon: LogOut },
  ];
}

function publicItems(): Item[] {
  return [
    { kind: 'link', href: '/', label: 'Home', Icon: Home },
    { kind: 'link', href: '/examples', label: 'Examples', Icon: Palette },
    { kind: 'link', href: '/pricing', label: 'Pricing', Icon: CreditCard },
    { kind: 'link', href: '/sign-in', label: 'Sign in', Icon: LogIn },
    { kind: 'link', href: '/sign-up', label: 'Sign up', Icon: UserPlus },
    ...legalItems,
  ];
}

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock scroll on body while open. Restore on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus management — when the drawer opens, focus the close button so
  // keyboard / screen-reader users land inside the dialog; when it
  // closes, return focus to the trigger they opened it with. Without
  // this, Tab can escape the open drawer into the page underneath,
  // which feels broken on mobile.
  useEffect(() => {
    if (open) {
      // wait one frame so the panel is in the DOM
      const id = requestAnimationFrame(() => closeRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    triggerRef.current?.focus();
    return undefined;
  }, [open]);

  const items = session ? authedItems() : publicItems();

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="text-foreground hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-md transition md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop + panel */}
      {open && (
        <div
          className="fixed inset-0 z-[90] md:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Navigation menu"
        >
          {/* Click-outside backdrop */}
          <div
            className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sliding panel — slides in from the trailing edge (right in
              LTR, left in RTL). The animation uses two separate keyframe
              rules selected via [dir='rtl'] on the wrapper, because CSS
              at-rules can't be nested inside attribute selectors (the
              previous attempt silently fell back to LTR everywhere,
              which made the Hebrew drawer slide leftward across the
              entire viewport — looked broken). */}
          <div className="bg-card resumaker-drawer-panel absolute inset-y-0 end-0 flex w-[85%] max-w-sm flex-col shadow-2xl">
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <Logo size="sm" href={session ? '/dashboard' : '/'} />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-foreground hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-md transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {items.map((it) => {
                if (it.kind === 'divider') {
                  return (
                    <div
                      key={`divider-${it.label}`}
                      className="border-border text-muted-foreground mt-3 border-t px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider"
                    >
                      {it.label}
                    </div>
                  );
                }
                if (it.kind === 'action') {
                  return (
                    <button
                      key={it.label}
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="text-foreground hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-start text-sm font-medium transition"
                    >
                      <it.Icon className="text-muted-foreground h-4 w-4" />
                      {it.label}
                    </button>
                  );
                }
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="text-foreground hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition"
                  >
                    <it.Icon className="text-muted-foreground h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
            </nav>

            {session && (
              <div className="border-border border-t px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-100 dark:bg-brand-900/40 flex h-9 w-9 items-center justify-center rounded-full">
                    <UserCircle className="text-brand-700 dark:text-brand-200 h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate text-sm font-medium">
                      {session.user.name}
                    </div>
                    <div className="text-muted-foreground truncate text-xs" dir="ltr">
                      {session.user.email}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Two animation keyframes — one slides in from the right
              (LTR), the other from the left (RTL). The previous version
              tried to nest @keyframes inside [dir='rtl'], which is
              invalid CSS, so Hebrew users got the LTR animation: the
              panel started off-screen to the right and slid LEFTWARD
              across the whole viewport to land at its left-anchored
              position. */}
          <style>{`
            @keyframes resumakerDrawerSlideFromRight {
              from { transform: translateX(100%); }
              to   { transform: translateX(0); }
            }
            @keyframes resumakerDrawerSlideFromLeft {
              from { transform: translateX(-100%); }
              to   { transform: translateX(0); }
            }
            [dir='ltr'] .resumaker-drawer-panel {
              animation: resumakerDrawerSlideFromRight 0.25s ease-out;
            }
            [dir='rtl'] .resumaker-drawer-panel {
              animation: resumakerDrawerSlideFromLeft 0.25s ease-out;
            }
            @media (prefers-reduced-motion: reduce) {
              .resumaker-drawer-panel { animation: none; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
