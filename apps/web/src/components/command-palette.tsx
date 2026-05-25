'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import {
  Search,
  ArrowRight,
  LayoutDashboard,
  FilePlus2,
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

function buildItems(isAuthed: boolean): CommandItem[] {
  const authedNav: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      group: 'Navigate',
      Icon: LayoutDashboard,
      href: '/dashboard',
    },
    {
      id: 'new-resume',
      label: 'New resume',
      keywords: 'create builder',
      group: 'Actions',
      Icon: FilePlus2,
      href: '/builder',
    },
    {
      id: 'cover-letter',
      label: 'New cover letter',
      keywords: 'create',
      group: 'Actions',
      Icon: Mail,
      href: '/cover-letters/new',
    },
    {
      id: 'cover-letters',
      label: 'My cover letters',
      group: 'Navigate',
      Icon: Mail,
      href: '/cover-letters',
    },
    {
      id: 'applications',
      label: 'My applications',
      keywords: 'jobs tracker',
      group: 'Navigate',
      Icon: TrendingUp,
      href: '/applications',
    },
    { id: 'jobs', label: 'Job hunt', group: 'Navigate', Icon: Briefcase, href: '/jobs' },
    { id: 'profile', label: 'Profile', group: 'Account', Icon: UserCircle, href: '/profile' },
    { id: 'settings', label: 'Settings', group: 'Account', Icon: Settings, href: '/settings' },
    {
      id: 'billing',
      label: 'Billing',
      keywords: 'subscription plan',
      group: 'Account',
      Icon: CreditCard,
      href: '/account/billing',
    },
    {
      id: 'sign-out',
      label: 'Sign out',
      group: 'Account',
      Icon: LogOut,
      action: 'sign-out',
    },
  ];
  const publicNav: CommandItem[] = [
    { id: 'home', label: 'Home', group: 'Navigate', Icon: Home, href: '/' },
    {
      id: 'examples',
      label: 'Examples',
      keywords: 'samples templates',
      group: 'Navigate',
      Icon: Palette,
      href: '/examples',
    },
    {
      id: 'pricing',
      label: 'Pricing',
      keywords: 'plans cost subscription',
      group: 'Navigate',
      Icon: CreditCard,
      href: '/pricing',
    },
  ];
  const guestActions: CommandItem[] = [
    { id: 'sign-in', label: 'Sign in', group: 'Account', Icon: LogIn, href: '/sign-in' },
    { id: 'sign-up', label: 'Sign up', group: 'Account', Icon: UserPlus, href: '/sign-up' },
  ];

  return isAuthed ? [...publicNav, ...authedNav] : [...publicNav, ...guestActions];
}

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => buildItems(Boolean(session)), [session]);

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

  if (!open) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center bg-neutral-950/60 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="border-border bg-card w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl">
        {/* Header: search input + kbd hint */}
        <div className="border-border flex items-center gap-3 border-b px-4 py-3">
          <Search className="text-muted-foreground h-4 w-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command or search…"
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
            aria-label="Search commands"
          />
          <kbd className="border-border bg-muted text-muted-foreground hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground px-4 py-12 text-center text-sm">
              No matches for &ldquo;{query}&rdquo;
            </div>
          ) : (
            (['Navigate', 'Actions', 'Account'] as const).map((groupName) => {
              const groupItems = grouped[groupName];
              if (groupItems.length === 0) return null;
              return (
                <div key={groupName} className="mb-2">
                  <div className="text-muted-foreground px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
                    {groupName}
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
                        className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
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
        <div className="border-border text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Quick nav</span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              <kbd className="border-border bg-muted mx-0.5 rounded border px-1.5 py-0.5 font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span>
              <kbd className="border-border bg-muted mx-0.5 rounded border px-1.5 py-0.5 font-mono">
                ↵
              </kbd>
              select
            </span>
            <span>
              <kbd className="border-border bg-muted mx-0.5 rounded border px-1.5 py-0.5 font-mono">
                <span aria-hidden>⌘</span>K
              </kbd>
              toggle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Small trigger button that opens the palette — drop into any header
 * for a discoverable affordance. Shows a faux search input with a
 * keyboard hint on the right.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
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
      aria-label="Open command palette"
      className={`border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition ${
        className ?? ''
      }`}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search or jump to…</span>
      <kbd className="border-border bg-card ms-auto hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
