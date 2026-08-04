/**
 * A coupon code captured from a promo link, held until the visitor is
 * actually able to use it.
 *
 * The problem this solves: a promo aimed at *new* users lands someone on
 * /pricing holding a code, but they can't buy anything until they have
 * an account. The signup detour then loses the code entirely —
 * sign-in redirects to /dashboard (not back to pricing), and /pricing is
 * the only place a code can be entered. In practice the code evaporates
 * and the promo doesn't convert.
 *
 * localStorage rather than sessionStorage on purpose: email verification
 * is part of signup here, and clicking a link in a mail client
 * frequently opens a *new tab* — which would drop sessionStorage. This
 * survives that, and any normal "close the tab, come back later" gap.
 *
 * Scoped by a TTL so a code someone picked up months ago doesn't
 * silently reappear on an unrelated purchase.
 */

const KEY = 'resumaker:pending-coupon';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Matches the `max(40)` on POST /api/billing/coupon. Anything longer
 * could never validate, so there is no reason to store or display it —
 * and `?coupon=` is attacker-controlled, so an uncapped value gets
 * echoed straight into the "code saved" banner and blows out the
 * layout.
 */
const MAX_CODE_LENGTH = 40;

interface StoredCoupon {
  code: string;
  savedAt: number;
}

/** Remember a code from `?coupon=` so it survives signup. */
export function savePendingCoupon(code: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > MAX_CODE_LENGTH) return;
  try {
    const payload: StoredCoupon = { code: trimmed, savedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private browsing / storage disabled — the code just won't persist.
    // Not worth surfacing; the manual field still works.
  }
}

/** The saved code, or null when absent or past its TTL. */
export function readPendingCoupon(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCoupon>;
    if (
      typeof parsed.code !== 'string' ||
      typeof parsed.savedAt !== 'number' ||
      parsed.code.length > MAX_CODE_LENGTH
    ) {
      // Length is re-checked on read, not just on write — a value
      // predating the cap (or hand-edited into storage) must not reach
      // the banner either.
      window.localStorage.removeItem(KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/**
 * Forget the code. Called once it's been redeemed, and whenever it turns
 * out to be invalid — a dead code shouldn't keep re-prompting on every
 * future visit.
 */
export function clearPendingCoupon(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
