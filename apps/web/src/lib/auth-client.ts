/**
 * Better Auth client for React components.
 *
 * Use this in client components for sign-in/up flows + session reads.
 *
 * Origin policy:
 *   - In the browser: use the CURRENT origin (window.location.origin).
 *     This is critical because the build-time NEXT_PUBLIC_APP_URL is
 *     baked into the bundle once — if it's `https://resumaker.co.il`
 *     but the user is browsing a `*.vercel.app` preview URL (or local
 *     network IP, or any other host), cross-origin fetches CORS-fail
 *     with the Safari error "Load failed". Same-origin makes the
 *     client work on whatever URL the user happens to be on.
 *   - During SSR (process.env.NEXT_PUBLIC_APP_URL): used as the
 *     fallback. SSR never actually calls the auth client's mutations,
 *     but createAuthClient wants a valid URL at construction time.
 */

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

function resolveBaseURL(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
