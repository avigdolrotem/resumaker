/**
 * Better Auth client for React components.
 *
 * Use this in client components for sign-in/up flows + session reads.
 */

import { createAuthClient } from 'better-auth/react';

// NEXT_PUBLIC_APP_URL is validated in src/lib/env.ts at build time, but
// we can't import the server-side env module here — this file ships in
// the client bundle. Read process.env directly; the build-time validator
// guarantees it's a non-empty URL.
const baseURL = process.env.NEXT_PUBLIC_APP_URL;
if (!baseURL) {
  // Loud-failure in dev/CI; in prod the build-time validator catches it
  // before this code runs.
  throw new Error('NEXT_PUBLIC_APP_URL must be set');
}

export const authClient = createAuthClient({
  baseURL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
