/**
 * Detect which OAuth providers are configured via env vars.
 * Called from server components only. Reads through the zod-validated
 * env so a typo in a secret would still resolve to "disabled" rather
 * than a half-configured provider.
 */

import { env } from '@/lib/env';

export function getOAuthProviders(): { google: boolean; github: boolean } {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  };
}
