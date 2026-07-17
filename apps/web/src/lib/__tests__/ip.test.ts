import { describe, it, expect } from 'vitest';
import { extractClientIp } from '../ip';

function req(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) };
}

describe('extractClientIp', () => {
  it('prefers CF-Connecting-IP when present', () => {
    expect(extractClientIp(req({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('CF-Connecting-IP wins even when X-Forwarded-For is also present (the real prod shape)', () => {
    // Real topology: Cloudflare sets CF-Connecting-IP to the visitor, then
    // GCLB appends ITS OWN view (Cloudflare's edge) as the rightmost
    // X-Forwarded-For entry — so trusting rightmost-XFF alone here would
    // return the Cloudflare edge IP, not the visitor.
    const headers = req({
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '1.2.3.4, 203.0.113.7, 34.120.0.10',
    });
    expect(extractClientIp(headers)).toBe('203.0.113.7');
  });

  it('falls back to the rightmost X-Forwarded-For entry when CF-Connecting-IP is absent', () => {
    // Leftmost is attacker-controlled (a client can send any value); the
    // rightmost is whatever our last proxy actually observed.
    const headers = req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' });
    expect(extractClientIp(headers)).toBe('203.0.113.7');
  });

  it('falls back to X-Real-IP when neither CF-Connecting-IP nor X-Forwarded-For is present', () => {
    expect(extractClientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('falls back to "unknown" when no IP header is present', () => {
    expect(extractClientIp(req({}))).toBe('unknown');
  });
});
