/**
 * Client-IP extraction with spoof resistance.
 *
 * Naive approach: read the leftmost entry of `X-Forwarded-For`. Wrong:
 * a client can send their own `X-Forwarded-For: 1.2.3.4` and our edge
 * (Vercel/CDN) APPENDS the real IP at the end. So the leftmost value is
 * attacker-controlled — anyone can craft a different IP per request and
 * trivially bypass per-IP rate limits.
 *
 * Correct approach: read the RIGHTMOST entry of `X-Forwarded-For`, which
 * is whatever our last trusted proxy wrote. On Vercel this is the real
 * client IP. Fall back to `X-Real-IP` (also set by Vercel) when the
 * header is absent, and finally to a literal `'unknown'` (which makes
 * all unknown-IP requests share a single rate-limit bucket — a safe
 * default that throttles abuse harder than letting them through).
 */
export function extractClientIp(req: { headers: Headers }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      // rightmost is the last-trusted hop — the real client IP on Vercel
      const ip = parts[parts.length - 1];
      if (ip) return ip;
    }
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
