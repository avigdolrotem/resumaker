'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { clearPendingCoupon } from '@/lib/pending-coupon';
import { Shortcut } from '@/components/ui/shortcut';
import {
  Search,
  ArrowRight,
  LayoutDashboard,
  FilePlus2,
  FileText,
  IdCard,
  Mail,
  Settings,
  UserCircle,
  CreditCard,
  Briefcase,
  Palette,
  LogOut,
  LogIn,
  UserPlus,
  Home,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

/**
 * Cmd+K / Ctrl+K command palette — the Linear / Vercel / Notion power
 * navigator. Opens a centered modal with a search input + filtered list
 * of every navigable route + every quick action ("New resume", "Sign
 * out", etc.).
 *
 * Why this and not a 3rd-party (cmdk):
 *  - Our route count is small (~20 items). Fuzzy search via library
 *    is overkill; case-insensitive substring match on label+keywords
 *    is plenty.
 *  - One less dependency to maintain + audit.
 *  - Full control over keyboard navigation (arrow keys + enter + esc).
 *  - Theme-aware styling without extra wrappers.
 *
 * Mounted once globally inside the [locale] layout. Listens for `mod+K`
 * (mod = Cmd on Mac, Ctrl elsewhere) anywhere on the page.
 */

type CommandItem = {
  id: string;
  label: string;
  keywords?: string;
  group: 'Navigate' | 'Actions' | 'Account';
  Icon: typeof Search;
  // Either a route or a handler — never both.
  href?:
    | '/dashboard'
    | '/builder'
    | '/resumes'
    | '/career-profile'
    | '/cover-letters'
    | '/cover-letters/new'
    | '/applications'
    | '/jobs'
    | '/settings'
    | '/profile'
    | '/account/billing'
    | '/admin'
    | '/examples'
    | '/pricing'
    | '/'
    | '/sign-in'
    | '/sign-up';
  action?: 'sign-out';
};

// `t` is intentionally untyped here — `useTranslations` returns a
// strongly-typed callable, but threading that type through this helper
// adds zero safety in exchange for noise.
type TFn = (key: string) => string;

function buildItems(isAuthed: boolean, t: TFn): CommandItem[] {
  const authedNav: CommandItem[] = [
    {
      id: 'dashboard',
      label: t('items.dashboard'),
      group: 'Navigate',
      Icon: LayoutDashboard,
      href: '/dashboard',
    },
    {
      id: 'new-resume',
      label: t('items.newResume'),
      keywords: t('items.newResumeKeywords'),
      group: 'Actions',
      Icon: FilePlus2,
      href: '/builder',
    },
    {
      id: 'resumes',
      label: t('items.resumes'),
      group: 'Navigate',
      Icon: FileText,
      href: '/resumes',
    },
    {
      id: 'career-profile',
      label: t('items.careerProfile'),
      keywords: t('items.careerProfileKeywords'),
      group: 'Navigate',
      Icon: IdCard,
      href: '/career-profile',
    },
    {
      id: 'cover-letter',
      label: t('items.newCoverLetter'),
      keywords: t('items.newCoverLetterKeywords'),
      group: 'Actions',
      Icon: Mail,
      href: '/cover-letters/new',
    },
    {
      id: 'cover-letters',
      label: t('items.coverLetters'),
      group: 'Navigate',
      Icon: Mail,
      href: '/cover-letters',
    },
    {
      id: 'applications',
      label: t('items.applications'),
      keywords: t('items.applicationsKeywords'),
      group: 'Navigate',
      Icon: TrendingUp,
      href: '/applications',
    },
    {
      id: 'jobs',
      label: t('items.jobs'),
      group: 'Navigate',
      Icon: Briefcase,
      href: '/jobs',
    },
    {
      id: 'profile',
      label: t('items.profile'),
      group: 'Account',
      Icon: UserCircle,
      href: '/profile',
    },
    {
      id: 'settings',
      label: t('items.settings'),
      group: 'Account',
      Icon: Settings,
      href: '/settings',
    },
    {
      id: 'billing',
      label: t('items.billing'),
      keywords: t('items.billingKeywords'),
      group: 'Account',
      Icon: CreditCard,
      href: '/account/billing',
    },
    {
      id: 'sign-out',
      label: t('items.signOut'),
      group: 'Account',
      Icon: LogOut,
      action: 'sign-out',
    },
  ];
  const publicNav: CommandItem[] = [
    { id: 'home', label: t('items.home'), group: 'Navigate', Icon: Home, href: '/' },
    {
      id: 'examples',
      label: t('items.examples'),
      keywords: t('items.examplesKeywords'),
      group: 'Navigate',
      Icon: Palette,
      href: '/examples',
    },
    {
      id: 'pricing',
      label: t('items.pricing'),
      keywords: t('items.pricingKeywords'),
      group: 'Navigate',
      Icon: CreditCard,
      href: '/pricing',
    },
  ];
  const guestActions: CommandItem[] = [
    {
      id: 'sign-in',
      label: t('items.signIn'),
      group: 'Account',
      Icon: LogIn,
      href: '/sign-in',
    },
    {
      id: 'sign-up',
      label: t('items.signUp'),
      group: 'Account',
      Icon: UserPlus,
      href: '/sign-up',
    },
  ];

  return isAuthed ? [...publicNav, ...authedNav] : [...publicNav, ...guestActions];
}

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations('commandPalette');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => buildItems(Boolean(session), t), [session, t]);

  // Filter items by substring match across label + keywords. Empty query
  // shows everything, grouped.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.keywords ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // Cmd+K (Mac) / Ctrl+K (everywhere else) toggles the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset query + focus input when opening.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Defer focus so the input is mounted.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Clamp activeIndex to filtered range whenever the list shrinks.
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered, activeIndex]);

  const runItem = useCallback(
    async (item: CommandItem) => {
      setOpen(false);
      if (item.action === 'sign-out') {
        // A held promo code lives in localStorage so it can survive the
        // signup detour, which means it outlives the session that picked it
        // up. On a shared machine the next person to sign in inherited a
        // banner about someone else's code. Nothing is granted by it —
        // validation and the once-per-user rule are enforced server-side —
        // but it reads like a leak, so drop it with the session.
        clearPendingCoupon();
        await signOut();
        router.push('/');
        router.refresh();
        return;
      }
      if (item.href) {
        router.push(item.href);
      }
    },
    [router],
  );

  // Arrow key navigation + enter to run.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) void runItem(item);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIndex, runItem]);

  // Group items by `group` for the list rendering.
  const grouped: Record<CommandItem['group'], CommandItem[]> = {
    Navigate: [],
    Actions: [],
    Account: [],
  };
  filtered.forEach((it) => grouped[it.group].push(it));

  // Flat index so arrow navigation maps to the right item across groups.
  let runningIndex = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('ariaLabel')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-neutral-950/50 p-4 pt-[15vh] backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="glass-strong shadow-glass-lg w-full max-w-xl overflow-hidden rounded-2xl"
          >
            {/* Header: search input + kbd hint */}
            <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
              <Search className="text-muted-foreground h-4 w-4" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder={t('placeholder')}
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
                aria-label={t('search')}
              />
              <kbd className="border-border/60 bg-background/60 text-muted-foreground hidden rounded-md border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                  {t('noMatches', { query })}
                </div>
              ) : (
                (['Navigate', 'Actions', 'Account'] as const).map((groupName) => {
                  const groupItems = grouped[groupName];
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={groupName} className="mb-2">
                      <div className="text-muted-foreground px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
                        {t(`groups.${groupName}`)}
                      </div>
                      {groupItems.map((it) => {
                        const idx = runningIndex++;
                        const isActive = idx === activeIndex;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => void runItem(it)}
                            className={`ease-smooth relative mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-200 ${
                              isActive
                                ? 'text-brand-700 dark:text-brand-100'
                                : 'text-foreground hover:bg-accent/40'
                            }`}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="command-palette-active-item"
                                className="from-brand-500/15 via-brand-500/10 to-brand-500/15 absolute inset-0 -z-10 rounded-xl bg-gradient-to-r"
                                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                              />
                            )}
                            <it.Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive
                                  ? 'text-brand-600 dark:text-brand-300'
                                  : 'text-muted-foreground'
                              }`}
                            />
                            <span className="flex-1 text-start">{it.label}</span>
                            {isActive && (
                              <ArrowRight className="text-brand-600 dark:text-brand-300 h-4 w-4" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="border-border/60 text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                <span>{t('footer.quickNav')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="border-border/60 bg-background/60 mx-0.5 rounded-md border px-1.5 py-0.5 font-mono">
                    ↑↓
                  </kbd>
                  {t('footer.navigate')}
                </span>
                <span>
                  <kbd className="border-border/60 bg-background/60 mx-0.5 rounded-md border px-1.5 py-0.5 font-mono">
                    ↵
                  </kbd>
                  {t('footer.select')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Shortcut keys={['mod', 'K']} /> {t('footer.toggle')}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact icon-only trigger that opens the palette — sits in the
 * account cluster next to the avatar menu, matching every other
 * circular header control (theme toggle, locale switcher). Used to be
 * a wide faux search bar with placeholder text + a visible ⌘K hint;
 * that stretched via `flex-1` to fill the header's middle and, once
 * the header had more competing for space, overflowed its own pill
 * background instead of wrapping or truncating. An icon has no text
 * to overflow.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const t = useTranslations('commandPalette.trigger');
  // Dispatches a synthetic mod+K event so the global listener in
  // CommandPalette handles it (one source of truth for open state).
  function open() {
    const e = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(e);
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('ariaLabel')}
      className={`glass hover:glass-strong text-foreground ease-snappy inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96] ${
        className ?? ''
      }`}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
