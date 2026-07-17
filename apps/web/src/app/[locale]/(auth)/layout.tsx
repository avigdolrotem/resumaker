import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GridPattern } from '@/components/ui-effects/grid-pattern';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { auth } from '@/lib/auth';

/**
 * Auth layout: sign-in / sign-up / forgot-password / reset-password
 * all share this shell.
 *
 * Light + dark aware: the background gradient + scrim are token-based
 * (bg-background, brand vars) so dark themes get a deep violet wash
 * instead of a forced white. Theme toggle + locale switcher in the
 * header so users can flip before signing in. No other nav links —
 * we don't want to encourage bouncing mid-auth.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Already signed in? Skip the auth form and send them to the app.
  // The Better Auth session cookie is the source of truth; if it's
  // valid, /sign-in and /sign-up should never be visible.
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="from-brand-50 to-accent-50 dark:from-background dark:via-background dark:to-background bg-background relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br via-white">
      {/* Backdrop layers — same recipe as the marketing hero */}
      <AnimatedMeshBg intensity="subtle" />
      <GridPattern size={48} className="opacity-40 dark:opacity-15" />
      {/* Scrim that fades content out toward the bottom, tinted with the
          theme's own background token on both sides — dark mode used to
          get a hardcoded white scrim forced over it (the white-on-white
          culprit on auth pages); token-based on both ends means it can't
          drift out of sync with whichever theme is active. */}
      <div
        aria-hidden
        className="from-background/0 via-background/40 to-background/80 pointer-events-none absolute inset-0 bg-gradient-to-b"
      />

      <header className="relative z-10">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo size="md" href="/" />
          {/* Theme + locale toggles available before sign-in — users
              who prefer dark or a different language shouldn't have
              to sign in first. Both components are client-side and
              persist their choice (cookie + localStorage). */}
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
