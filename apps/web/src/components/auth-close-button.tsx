'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/**
 * Closes out of the auth flow back to wherever the user was before
 * clicking Sign in/up — sign-in/up is reachable from anywhere on the
 * site (header CTA, gated actions, etc.), so a hardcoded "back to
 * home" link would strand people who came from somewhere else.
 *
 * Deliberately a plain `router.back()`, no "no history" fallback —
 * `window.history.length` isn't a usable signal for that (it's ≥2 on
 * every page, including a genuinely first/direct load, since the
 * browser's own initial blank document already counts as entry 1).
 * The one edge case this can't help (a direct/bookmarked link to
 * /sign-in with no real history) just no-ops on click, same as a
 * browser back button/gesture would in that situation — not broken,
 * just inert.
 */
export function AuthCloseButton() {
  const t = useTranslations('auth.common');
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label={t('close')}
      className="glass hover:glass-strong text-foreground ease-snappy inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96]"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
