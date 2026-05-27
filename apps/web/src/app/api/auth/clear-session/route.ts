/**
 * GET /api/auth/clear-session?to=/sign-in
 *
 * Clears every `resumaker.*` cookie (the prefix matches `cookiePrefix`
 * in apps/web/src/lib/auth.ts) and redirects to the `to` query param
 * (default `/sign-in`). The redirect target is restricted to relative
 * paths starting with `/` to prevent open-redirect.
 *
 * Server Components can read but not mutate cookies in Next 16; this
 * route handler exists so the (app) layout can redirect through here
 * when `auth.api.getSession()` returns null but a stale session
 * cookie is still on the request — the half-signed-in state caused
 * by DB-side session deletion (admin grant, password reset, etc).
 */

import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_PREFIX = 'resumaker.';

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const rawTo = url.searchParams.get('to') ?? '/sign-in';
  // Open-redirect guard — only allow same-origin relative paths.
  const to = rawTo.startsWith('/') && !rawTo.startsWith('//') ? rawTo : '/sign-in';

  const redirectUrl = new URL(to, url.origin);
  const res = NextResponse.redirect(redirectUrl, 307);

  // Iterate every cookie on the request, delete every resumaker.*
  // entry. Better Auth uses session_token, session_data, and a few
  // CSRF/state cookies all sharing the prefix.
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith(COOKIE_PREFIX)) {
      res.cookies.set({
        name: c.name,
        value: '',
        maxAge: 0,
        path: '/',
      });
    }
  }

  return res;
}
