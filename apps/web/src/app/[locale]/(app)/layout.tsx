import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';
import { Link } from '@/i18n/navigation';
import { SessionGuard } from '@/components/session-guard';
import { ApiUpgradeListener } from '@/components/api-upgrade-listener';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';

/**
 * Layout for all signed-in app pages. Redirects to /sign-in if no session.
 *
 * Includes a slim legal footer with links to Privacy / Terms /
 * Accessibility / Contact. Required by Israeli accessibility law
 * (חוק שוויון זכויות לאנשים עם מוגבלות) — the accessibility statement
 * must be reachable from every page, including the authenticated app
 * shell. Also satisfies the Privacy Law disclosure requirement that
 * data subjects can always find the contact for data-subject requests.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // The orphan cookie left behind by a deleted session is cleared
    // by the /api/auth/clear-session route handler — route handlers
    // can mutate cookies; Server Components cannot. Redirecting
    // through clear-session sets `Set-Cookie: ...=; Max-Age=0` on
    // every resumaker.* cookie before bouncing to /sign-in.
    redirect('/api/auth/clear-session?to=/sign-in');
  }

  return (
    <div className="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
      {/* Ambient liquid backdrop, fixed to the viewport so it stays put
          under scrolling content — this is what makes the glass cards
          site-wide (not just the dashboard) actually have something
          translucent to blur. Low intensity + low opacity so dense
          pages (tables, forms) stay readable. */}
      <AnimatedMeshBg intensity="subtle" className="fixed opacity-30 dark:opacity-40" />
      {/* Layer B: client-side watchdog that force-reloads if the
          session ever flips from truthy to null while the operator is
          on a page (e.g. their session is revoked mid-tab). Server
          layout above is the primary defence; this catches the
          edge case where SSR didn't run again. */}
      <SessionGuard />
      {/* Global 402 → UpgradeModal interceptor. Every tier-gated client
          fetch goes through `apiFetch`, which dispatches an event that
          this listener turns into the existing upgrade modal — call
          sites don't manage modal state themselves. */}
      <ApiUpgradeListener />
      <AppHeader />
      <main id="main" className="text-foreground container relative z-10 mx-auto flex-1 px-4 py-8">
        {children}
      </main>
      <AppLegalFooter />
    </div>
  );
}

async function AppLegalFooter() {
  const t = await getTranslations('legalNav');
  return (
    <footer className="border-border/50 text-muted-foreground relative z-10 border-t py-4 text-xs">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4">
        <Link href="/privacy" className="hover:text-foreground ease-snappy transition-colors">
          {t('privacy')}
        </Link>
        <Link href="/terms" className="hover:text-foreground ease-snappy transition-colors">
          {t('terms')}
        </Link>
        <Link
          href="/legal/accessibility"
          className="hover:text-foreground ease-snappy transition-colors"
        >
          {t('accessibility')}
        </Link>
        <Link
          href="/legal/data-retention"
          className="hover:text-foreground ease-snappy transition-colors"
        >
          {t('dataRetention')}
        </Link>
        <Link href="/contact" className="hover:text-foreground ease-snappy transition-colors">
          {t('contact')}
        </Link>
        <span className="text-muted-foreground/60">·</span>
        <span>© 2026 Resumaker</span>
      </div>
    </footer>
  );
}
