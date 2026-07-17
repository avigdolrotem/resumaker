/**
 * Client-IP extraction with spoof resistance.
 *
 * Production topology (see README.md): Browser → Cloudflare → GKE Ingress
 * (`className: gce`, i.e. a GCP external HTTP(S) Load Balancer) → this app.
 * That matters because it's a TWO-hop chain, not one:
 *
 *   1. Cloudflare sets `CF-Connecting-IP` to the true visitor IP — this
 *      header is set by Cloudflare's edge itself and cannot be spoofed by
 *      the client (Cloudflare overwrites/strips any client-sent copy).
 *   2. GCLB then appends ITS OWN view of the connecting IP —
 *      Cloudflare's edge IP, not the visitor's — to `X-Forwarded-For`.
 *      So by the time a request reaches this app, the *rightmost*
 *      `X-Forwarded-For` entry is a Cloudflare edge IP, not the visitor.
 *      (This app previously ran behind a single-hop edge where "rightmost
 *      X-Forwarded-For entry" was correct; that stopped being true once
 *      GCLB was added in front as a second hop — see
 *      docs/superpowers/plans/2026-05-26-gcp-migration.md.)
 *
 * So: prefer `CF-Connecting-IP` (authoritative, set by our actual edge).
 * Fall back to the rightmost `X-Forwarded-For` entry — still the right
 * instinct for spoof-resistance (a client can send `X-Forwarded-For:
 * 1.2.3.4` and whichever proxy is actually last in the chain appends the
 * real IP after it, so the leftmost value is always attacker-controlled)
 * — for local dev, previews, or if Cloudflare is ever bypassed. Finally
 * fall back to `X-Real-IP`, then a literal `'unknown'` (which makes all
 * unknown-IP requests share a single rate-limit bucket — a safe default
 * that throttles abuse harder than letting it through).
 */
export function extractClientIp(req: { headers: Headers }): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      // rightmost is the last-trusted hop
      const ip = parts[parts.length - 1];
      if (ip) return ip;
    }
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
