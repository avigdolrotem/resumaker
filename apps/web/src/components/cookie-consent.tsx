'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Cookie consent banner — required by Israeli Privacy Protection Law
 * §1981 (disclosure of cookies for non-essential purposes).
 *
 * We use:
 *   - Session cookies (Better Auth `resumaker.session_token`)         essential
 *   - Locale cookie (`NEXT_LOCALE`)                                  essential
 *   - Sentry trace cookie (only when SENTRY_DSN is set)              functional
 *
 * Right now we only store essential + functional cookies (no
 * advertising, no third-party trackers), so the banner is purely
 * informational. If we ever add analytics with non-essential
 * cookies, this banner needs an "accept / reject" choice instead
 * of just "got it".
 *
 * Dismissal is stored in localStorage so it doesn't reappear on
 * every visit. Survives sign-out / page reload.
 */

const STORAGE_KEY = 'resumaker.cookieConsent';

export function CookieConsent({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read in effect so SSR + initial hydration don't render the banner
    // (avoids flash + matches the localStorage decision the user made).
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage blocked (private mode, iframe). Show anyway —
      // dismissal just won't persist, which is acceptable.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  const isHe = locale === 'he';

  return (
    // `region`, not `dialog`. This is a passive notice that never blocks
    // the page — there's no backdrop, no focus trap, and dismissing it is
    // optional. Declaring it a dialog told assistive tech (and anything
    // driving the browser) that a modal had taken over, so interactions
    // got scoped to this bar and clicks elsewhere on the page appeared to
    // do nothing at all.
    <div
      role="region"
      aria-labelledby="cookie-consent-title"
      className="border-border bg-card fixed bottom-4 end-4 start-4 z-50 mx-auto max-w-2xl rounded-xl border p-4 shadow-2xl sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="text-foreground flex-1 text-sm">
          <h2 id="cookie-consent-title" className="text-foreground mb-1 font-semibold">
            {isHe ? 'אנחנו משתמשים בעוגיות חיוניות' : 'We use essential cookies'}
          </h2>
          <p className="leading-relaxed">
            {isHe
              ? 'עוגיות התחברות ושמירת העדפת שפה הן הכרחיות לפעולת האתר. לא נשתמש בעוגיות שיווק ולא נמכור מידע אישי.'
              : "Auth and language-preference cookies are needed for the app to work. We don't run ad trackers and don't sell personal data."}{' '}
            <Link href="/privacy" className="text-brand-600 hover:text-brand-700 underline">
              {isHe ? 'מדיניות הפרטיות' : 'Privacy policy'}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-medium text-white transition"
          aria-label={isHe ? 'סגור הודעת עוגיות' : 'Dismiss cookie notice'}
        >
          <span className="hidden sm:inline">{isHe ? 'הבנתי' : 'Got it'}</span>
          <X className="h-4 w-4 sm:hidden" />
        </button>
      </div>
    </div>
  );
}
