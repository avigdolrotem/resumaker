/**
 * Job Description parser.
 *
 * Two paths:
 *  1. Direct text paste (always works)
 *  2. URL fetch (via Playwright for v1; Firecrawl can be added later)
 *
 * Detects language to inform downstream LLM call.
 */

import { sanitizeInput } from '@resumaker/ai-safety';
import type { Locale } from '@resumaker/shared';

export interface ParseJDInput {
  /** Text pasted by user. Either this OR url required. */
  text?: string;
  /** URL to fetch and extract content from. */
  url?: string;
  /** Locale override; if omitted, auto-detected. */
  forceLocale?: Locale | 'auto';
}

export interface ParseJDResult {
  cleaned: string;
  detectedLocale: Locale;
  source: 'paste' | 'url';
  warnings: string[];
}

const HEBREW_REGEX = /[֐-׿יִ-ﭏ]/g;

/**
 * Naive language detection: count Hebrew chars vs Latin chars.
 * Above 20% Hebrew chars → he, otherwise → en.
 *
 * Other languages default to en (per AI_SAFETY.md decision).
 */
function detectLocale(text: string): Locale {
  const totalChars = text.replace(/\s/g, '').length || 1;
  const hebrewChars = (text.match(HEBREW_REGEX) ?? []).length;
  const hebrewRatio = hebrewChars / totalChars;
  return hebrewRatio > 0.2 ? 'he' : 'en';
}

export async function parseJD(input: ParseJDInput): Promise<ParseJDResult> {
  const warnings: string[] = [];

  let rawText = '';
  let source: 'paste' | 'url' = 'paste';

  if (input.text) {
    rawText = input.text;
    source = 'paste';
  } else if (input.url) {
    rawText = await fetchUrl(input.url);
    source = 'url';
  } else {
    throw new Error('Either text or url required');
  }

  // Sanitize
  const sanitized = sanitizeInput(rawText);
  if (sanitized.rejected) {
    throw new Error(`JD rejected: ${sanitized.reason}`);
  }
  if (sanitized.detections.length > 0) {
    warnings.push(`Suspicious patterns: ${sanitized.detections.length}`);
  }

  // Detect locale
  let detectedLocale: Locale;
  if (input.forceLocale && input.forceLocale !== 'auto') {
    detectedLocale = input.forceLocale;
  } else {
    detectedLocale = detectLocale(sanitized.cleaned);
  }

  return {
    cleaned: sanitized.cleaned,
    detectedLocale,
    source,
    warnings,
  };
}

/**
 * Fetch a URL and extract its main content.
 *
 * V1: simple fetch + naive HTML stripping.
 * V2: Playwright headless for JS-rendered pages.
 * V3: Firecrawl for sites with anti-bot.
 */
async function fetchUrl(url: string): Promise<string> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs allowed');
  }

  // Quick hostname-string check (catches plaintext private IPs in the URL).
  // This also covers bare-IP inputs (e.g. http://192.168.1.1/) — the
  // isPrivateHostname check runs on the raw hostname before any DNS
  // resolution, so a bare private IP never reaches fetch().
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('Private hosts not allowed');
  }

  // Additional reserved ranges not covered by the named-host check:
  // 0.0.0.0/8 (this-network), 240.0.0.0/4 (reserved/future use).
  // These can appear as bare IPs in URLs and skip DNS resolution entirely.
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (/^0\./.test(rawHost)) {
    throw new Error('Private hosts not allowed');
  }
  if (/^24[0-9]\.|^25[0-5]\./.test(rawHost)) {
    throw new Error('Private hosts not allowed');
  }

  // SSRF: resolve DNS first AND fetch against the resolved IP to
  // defeat DNS rebinding. The previous version called `assertPublicHost`
  // (resolve + validate) but then `fetch(url, ...)` re-resolved — a
  // short-TTL rebinding attack could flip the IP between the check and
  // the fetch. Pinning to the validated IP closes that gap.
  const pinnedIp = await resolveAndAssertPublic(parsed.hostname);
  // Rewrite URL to the IP, preserve original hostname via Host header
  // so SNI + virtual hosting still work for shared-IP services.
  // For HTTPS we accept that some servers will reject due to SNI
  // mismatch — those are typically not the target of SSRF anyway.
  const ipUrl = new URL(url);
  const isIpv6 = pinnedIp.includes(':');
  ipUrl.hostname = isIpv6 ? `[${pinnedIp}]` : pinnedIp;

  const res = await fetch(ipUrl.toString(), {
    headers: {
      'User-Agent': 'ResumakerBot/1.0 (+https://resumaker.co.il)',
      Accept: 'text/html,application/xhtml+xml',
      Host: parsed.host, // preserve original Host for virtual-hosted servers
    },
    signal: AbortSignal.timeout(15_000),
    // Disable redirects — each redirect target would need its own DNS
    // resolve + validation, and a 30x response is rare for legit JD pages.
    // Caller can re-submit a final URL if needed.
    redirect: 'manual',
  });

  if (!res.ok) {
    throw new Error(`URL returned HTTP ${res.status}`);
  }

  const html = await res.text();
  return stripHtml(html);
}

function isPrivateHostname(host: string): boolean {
  const lower = host.toLowerCase();
  // localhost variants
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '::'].includes(lower)) return true;
  // private IPv4
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true; // link-local + cloud metadata
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(lower)) return true; // CGNAT 100.64.0.0/10
  if (/^127\./.test(lower)) return true; // loopback range
  // private IPv6 prefixes — bracketed in URLs but Hostname strips brackets
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // fe80::/10 link-local
  return false;
}

function ipIsPrivate(ip: string): boolean {
  // Re-use the hostname check on the resolved IP string
  if (isPrivateHostname(ip)) return true;
  // Additional IPv6 forms after resolution
  if (ip === '::1' || ip === '::') return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped && v4mapped[1]) return isPrivateHostname(v4mapped[1]);
  return false;
}

/**
 * Resolve the hostname, validate every returned address is public,
 * and return the **first** public IP for pinning. Defeats DNS rebinding
 * because the caller fetches against the returned IP directly — not
 * against the hostname (which could re-resolve to a private IP between
 * our check and the fetch).
 *
 * Prefers IPv4 when both are present, since fewer middleboxes mishandle it.
 */
async function resolveAndAssertPublic(hostname: string): Promise<string> {
  const { lookup } = await import('node:dns/promises');
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error('Cannot resolve URL host');
  }
  if (addresses.length === 0) {
    throw new Error('Cannot resolve URL host');
  }
  for (const addr of addresses) {
    if (ipIsPrivate(addr.address)) {
      throw new Error('Resolved IP is private — blocked for security');
    }
  }
  const ipv4 = addresses.find((a) => a.family === 4);
  return (ipv4 ?? addresses[0])!.address;
}

function stripHtml(html: string): string {
  // Naive but effective for most cases:
  // 1. Remove scripts and styles entirely
  // 2. Replace tags with spaces
  // 3. Decode common HTML entities
  // 4. Collapse whitespace
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/\s+/g, ' ').trim();
  return text;
}
