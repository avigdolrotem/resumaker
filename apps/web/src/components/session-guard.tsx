'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';

/**
 * Watches useSession() and force-reloads the page to /sign-in when the
 * session transitions from truthy to null without a sign-out action.
 *
 * Defends against the "half-signed-in state" where the server-rendered
 * shell shows a logged-in UI because the cookie cache is still valid,
 * but the underlying session row has been deleted (admin promotion,
 * password reset, security revoke). The server-side layout above
 * already clears cookies + redirects on its own getSession() call, but
 * a single client-side navigation may run between SSR refreshes and
 * leave the user stranded with stale data.
 *
 * Renders nothing.
 */
export function SessionGuard() {
  const { data: session, isPending } = useSession();
  // Track the previous session state so we only trigger on truthy → null
  // (not on initial-load null while the SDK is still hydrating).
  const sawSession = useRef(false);

  useEffect(() => {
    if (isPending) return;
    if (session) {
      sawSession.current = true;
      return;
    }
    if (sawSession.current && typeof window !== 'undefined') {
      // Hard reload — clears all in-memory React state including any
      // cached useSession data, and lets the server layout do its
      // cookie-clear-and-redirect dance. window.location.assign keeps
      // a callbackUrl so we return here after re-auth.
      const callback = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/sign-in?callbackUrl=${callback}`);
    }
  }, [session, isPending]);

  return null;
}
