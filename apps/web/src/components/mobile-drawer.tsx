'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  Menu,
  X,
  LayoutDashboard,
  FileText,
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
  Gift,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { useAuthModal } from './auth/auth-modal';
import { useRouter } from '@/i18n/navigation';
import { Logo } from './logo';

type NavT = ReturnType<typeof useTranslations<'nav'>>;
type LegalT = ReturnType<typeof useTranslations<'legalNav'>>;

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
  | '/resumes'
  | '/cover-letters'
  | '/cover-letters/new'
  | '/applications'
  | '/jobs'
  | '/settings'
  | '/profile'
  | '/account/billing'
  | '/referral'
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
  | {
      kind: 'action';
      action: 'sign-out' | 'open-sign-in' | 'open-sign-up';
      label: string;
      Icon: typeof Menu;
    };

/**
 * Legal links visible to BOTH signed-in and signed-out users. Required
 * to be reachable from every page under Israeli accessibility law
 * (חוק שוויון זכויות לאנשים עם מוגבלות) — the accessibility statement
 * in particular must have a clear link, including from inside the
 * authed app shell.
 */
function legalItems(tLegal: LegalT): Item[] {
  return [
    { kind: 'divider', label: tLegal('sectionTitle') },
    { kind: 'link', href: '/contact', label: tLegal('contact'), Icon: MessageSquare },
    { kind: 'link', href: '/privacy', label: tLegal('privacy'), Icon: Shield },
    { kind: 'link', href: '/terms', label: tLegal('terms'), Icon: ScrollText },
    {
      kind: 'link',
      href: '/legal/accessibility',
      label: tLegal('accessibility'),
      Icon: Accessibility,
    },
    {
      kind: 'link',
      href: '/legal/data-retention',
      label: tLegal('dataRetention'),
      Icon: Archive,
    },
  ];
}

function authedItems(t: NavT, tLegal: LegalT): Item[] {
  return [
    { kind: 'link', href: '/dashboard', label: t('dashboard'), Icon: LayoutDashboard },
    { kind: 'link', href: '/builder', label: t('newResume'), Icon: FilePlus2 },
    { kind: 'link', href: '/resumes', label: t('myResumes'), Icon: FileText },
    { kind: 'link', href: '/cover-letters', label: t('coverLetters'), Icon: Mail },
    { kind: 'link', href: '/applications', label: t('applications'), Icon: TrendingUp },
    { kind: 'link', href: '/jobs', label: t('jobs'), Icon: Briefcase },
    { kind: 'link', href: '/examples', label: t('examples'), Icon: Palette },
    { kind: 'link', href: '/profile', label: t('profile'), Icon: UserCircle },
    { kind: 'link', href: '/settings', label: t('settings'), Icon: Settings },
    { kind: 'link', href: '/account/billing', label: t('billing'), Icon: CreditCard },
    { kind: 'link', href: '/referral', label: t('referral'), Icon: Gift },
    ...legalItems(tLegal),
    { kind: 'action', action: 'sign-out', label: t('signOut'), Icon: LogOut },
  ];
}

function publicItems(t: NavT, tLegal: LegalT): Item[] {
  return [
    { kind: 'link', href: '/', label: t('home'), Icon: Home },
    { kind: 'link', href: '/examples', label: t('examples'), Icon: Palette },
    { kind: 'link', href: '/pricing', label: t('pricing'), Icon: CreditCard },
    // Open the auth overlay instead of navigating — same as the
    // desktop header's MarketingAuthCta, see auth-modal.tsx.
    { kind: 'action', action: 'open-sign-in', label: t('signIn'), Icon: LogIn },
    { kind: 'action', action: 'open-sign-up', label: t('signUp'), Icon: UserPlus },
    ...legalItems(tLegal),
  ];
}

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations('nav');
  const tLegal = useTranslations('legalNav');
  const tDrawer = useTranslations('mobileDrawer');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Portal target — `document.body` is only available after hydration, so
  // we resolve it client-side. Before hydration the burger button still
  // renders; the overlay simply isn't open yet, so there's nothing to
  // portal.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

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

  const items = session ? authedItems(t, tLegal) : publicItems(t, tLegal);
  const { openAuthModal } = useAuthModal();

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push('/');
    router.refresh();
  }

  function handleAction(action: 'sign-out' | 'open-sign-in' | 'open-sign-up') {
    if (action === 'sign-out') {
      void handleSignOut();
      return;
    }
    // Close the drawer before opening the modal — having both overlays
    // stacked at once looks broken, and the modal is the one the user
    // actually asked for by tapping Sign in/up.
    setOpen(false);
    openAuthModal(action === 'open-sign-in' ? 'sign-in' : 'sign-up');
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tDrawer('openMenu')}
        aria-expanded={open}
        className="text-foreground hover:bg-accent/70 ease-snappy inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-90 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop + panel — portaled to <body> so it escapes the
          containing block created by the header's `backdrop-filter`
          ancestor. CSS spec: any element with non-`none` backdrop-filter
          becomes a containing block for fixed-positioned descendants,
          which would otherwise have anchored the overlay to the 64px
          header bar instead of the viewport — the drawer rendered as a
          tiny clipped panel sitting under the menu button. */}
      {open &&
        portalTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] md:hidden"
            aria-modal="true"
            role="dialog"
            aria-label={tDrawer('navigationMenu')}
          >
            {/* Click-outside backdrop */}
            <div
              className="absolute inset-0 bg-neutral-950/50 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />

            {/* Sliding panel — slides in from the trailing edge (right in
              LTR, left in RTL). The animation uses two separate keyframe
              rules selected via [dir='rtl'] on the wrapper, because CSS
              at-rules can't be nested inside attribute selectors (the
              previous attempt silently fell back to LTR everywhere,
              which made the Hebrew drawer slide leftward across the
              entire viewport — looked broken). */}
            <div className="glass-strong resumaker-drawer-panel absolute inset-y-0 end-0 flex w-[85%] max-w-sm flex-col rounded-s-3xl">
              <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
                <Logo size="sm" href={session ? '/dashboard' : '/'} />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={tDrawer('closeMenu')}
                  className="text-foreground hover:bg-accent/70 ease-snappy inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-90"
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
                        className="border-border/50 text-muted-foreground mt-3 border-t px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider"
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
                        onClick={() => handleAction(it.action)}
                        className="text-foreground hover:bg-accent/60 ease-snappy mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-medium transition-all duration-200"
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
                      className="text-foreground hover:bg-accent/60 ease-snappy mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200"
                    >
                      <it.Icon className="text-muted-foreground h-4 w-4" />
                      {it.label}
                    </Link>
                  );
                })}
              </nav>

              {session && (
                <div className="border-border/50 border-t px-4 py-3">
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
              animation: resumakerDrawerSlideFromRight 0.4s var(--ease-smooth);
            }
            [dir='rtl'] .resumaker-drawer-panel {
              animation: resumakerDrawerSlideFromLeft 0.4s var(--ease-smooth);
            }
            @media (prefers-reduced-motion: reduce) {
              .resumaker-drawer-panel { animation: none; }
            }
          `}</style>
          </div>,
          portalTarget,
        )}
    </>
  );
}
