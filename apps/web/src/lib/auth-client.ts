/**
 * Better Auth client for React components.
 *
 * Use this in client components for sign-in/up flows + session reads.
 */

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? '',
});

export const { signIn, signUp, signOut, useSession } = authClient;
