import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all routes except for:
    // - api routes
    // - _next internals
    // - /offline (PWA service-worker fallback — lives outside the locale tree)
    // - static files
    '/((?!api|_next|_vercel|offline|.*\\..*).*)',
  ],
};
