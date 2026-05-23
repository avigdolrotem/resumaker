/**
 * SSRF protection tests for the URL fetcher in jd-parser.ts.
 *
 * We can't easily invoke fetchUrl directly (it requires Node DNS), so we
 * test the pure host-classification helpers via a small inline copy that
 * mirrors the implementation. This is a regression net: if the rules in
 * jd-parser change, copy them here too. (Future: extract to a shared util.)
 */

import { describe, it, expect } from 'vitest';

// Mirrored from apps/web/src/lib/jd-parser.ts — keep in sync
function isPrivateHostname(host: string): boolean {
  const lower = host.toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '::'].includes(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(lower)) return true;
  if (/^127\./.test(lower)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  return false;
}

describe('SSRF: isPrivateHostname', () => {
  describe('blocks localhost variants', () => {
    it.each([
      'localhost',
      '127.0.0.1',
      '127.0.0.2',
      '127.255.255.254',
      '::1',
      '0.0.0.0',
      'LOCALHOST',
    ])('blocks %s', (host) => expect(isPrivateHostname(host)).toBe(true));
  });

  describe('blocks RFC1918 private IPv4', () => {
    it.each([
      '10.0.0.1',
      '10.255.255.255',
      '192.168.0.1',
      '192.168.255.255',
      '172.16.0.1',
      '172.31.255.255',
    ])('blocks %s', (host) => expect(isPrivateHostname(host)).toBe(true));
  });

  describe('allows public IPs adjacent to private ranges', () => {
    it.each([
      '11.0.0.1',
      '192.169.0.1',
      '172.15.255.255', // just below 172.16
      '172.32.0.1', // just above 172.31
      '193.168.0.1',
      '8.8.8.8',
      '1.1.1.1',
    ])('allows %s', (host) => expect(isPrivateHostname(host)).toBe(false));
  });

  describe('blocks link-local + cloud metadata', () => {
    it('blocks AWS metadata 169.254.169.254', () => {
      expect(isPrivateHostname('169.254.169.254')).toBe(true);
    });
    it('blocks GCP metadata host 169.254.169.254', () => {
      expect(isPrivateHostname('169.254.169.254')).toBe(true);
    });
    it.each(['169.254.0.1', '169.254.255.254'])('blocks link-local %s', (host) =>
      expect(isPrivateHostname(host)).toBe(true),
    );
  });

  describe('blocks CGNAT 100.64.0.0/10', () => {
    it.each(['100.64.0.1', '100.127.255.255', '100.100.50.50'])('blocks CGNAT %s', (host) =>
      expect(isPrivateHostname(host)).toBe(true),
    );
    it.each(['100.0.0.1', '100.63.255.255', '100.128.0.1', '100.200.0.1'])(
      'allows non-CGNAT %s',
      (host) => expect(isPrivateHostname(host)).toBe(false),
    );
  });

  describe('blocks IPv6 private ranges', () => {
    it.each([
      'fc00:0000:0000:0000:0000:0000:0000:0001',
      'fd00:1234:5678::1',
      'fe80::1',
      'fe90::1',
      'fea0::1',
      'feb0::1',
    ])('blocks IPv6 %s', (host) => expect(isPrivateHostname(host)).toBe(true));
  });

  describe('allows public domains', () => {
    it.each(['example.com', 'github.com', 'linkedin.com', 'workable.com', 'comeet.co'])(
      'allows %s',
      (host) => expect(isPrivateHostname(host)).toBe(false),
    );
  });

  describe('case insensitive', () => {
    it.each(['LOCALHOST', 'Localhost', 'LoCaLhOsT'])('blocks %s', (host) =>
      expect(isPrivateHostname(host)).toBe(true),
    );
  });
});
