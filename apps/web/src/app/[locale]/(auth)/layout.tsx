import type { ReactNode } from 'react';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GridPattern } from '@/components/ui-effects/grid-pattern';
import { Logo } from '@/components/logo';

/**
 * Auth layout: sign-in / sign-up / forgot-password / reset-password
 * all share this shell.
 *
 * Modern aiapply-style:
 *  - Animated mesh background drifting behind the form
 *  - Frosted-glass card centered on screen
 *  - Wordmark links back to /
 *  - Soft gradient grid for depth
 *
 * No nav links here — we don't want to encourage navigation away
 * mid-auth (lower bounce on the funnel).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="from-brand-50 relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br via-white to-purple-50">
      {/* Backdrop layers — same recipe as the marketing hero */}
      <AnimatedMeshBg intensity="subtle" />
      <GridPattern size={48} className="opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/40 to-white/80"
      />

      <header className="relative z-10">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Logo size="md" href="/" />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
