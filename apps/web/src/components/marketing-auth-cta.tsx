'use client';

import { GlowButton } from './ui-effects/glow-button';
import { useAuthModal } from './auth/auth-modal';

/**
 * Signed-out marketing header's Sign in / Sign up pair. Split out as
 * its own client component (MarketingHeader itself is a server
 * component, for the session read) purely to reach useAuthModal() —
 * opens the overlay instead of navigating, so the marketing page the
 * visitor was looking at stays visible behind it. Same GlowButton/Link
 * markup as before, just `onClick` instead of `href`.
 */
export function MarketingAuthCta({
  signUpLabel,
  signInLabel,
}: {
  signUpLabel: string;
  signInLabel: string;
}) {
  const { openAuthModal } = useAuthModal();

  return (
    <>
      <button
        type="button"
        onClick={() => openAuthModal('sign-up')}
        className="text-foreground/80 hover:text-brand-700 hover:bg-accent/60 dark:hover:text-brand-200 ease-snappy hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 md:inline"
      >
        {signUpLabel}
      </button>
      <GlowButton type="button" size="md" onClick={() => openAuthModal('sign-in')}>
        {signInLabel}
      </GlowButton>
    </>
  );
}
