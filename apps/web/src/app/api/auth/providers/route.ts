/**
 * GET /api/auth/providers
 *
 * Returns which OAuth providers are configured. No auth required —
 * this is needed by anonymous sign-in/sign-up pages.
 */

import { NextResponse } from 'next/server';
import { getOAuthProviders } from '@/lib/oauth-providers';

export async function GET(): Promise<Response> {
  return NextResponse.json(getOAuthProviders());
}
