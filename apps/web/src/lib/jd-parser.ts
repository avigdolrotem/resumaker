/**
 * Job Description parser.
 *
 * Two paths:
 *  1. Direct text paste (always works)
 *  2. URL fetch — plain `fetch()` + regex HTML stripping (see fetchUrl
 *     below), NOT headless-rendered. Fine for static/SSR job pages;
 *     JS-rendered ones can come back thin or empty since nothing here
 *     executes client-side JS. Playwright/Firecrawl would fix that but
 *     aren't wired in — this comment used to claim Playwright was
 *     already in use for v1, which was never true.
 *
 * Detects language to inform downstream LLM call.
 */

import { sanitizeInput } from '@resumaker/ai-safety';
import type { Locale } from '@resumaker/shared';

// Comfortably under sanitizeInput's 20k hard limit — see the comment at
// its one call site below (fetchUrl) for why this exists at all.
const URL_FETCH_CHAR_LIMIT = 15_000;

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
  // Job-board redirects are common (bare host -> www, http -> https, a
  // shortlink, an ATS canonicalizing its own URLs) — treating every 30x
  // as a hard failure ("JD parse failed") was too strict. But blindly
  // following them (fetch's `redirect: 'follow'`) would undo the SSRF
  // protection below: it only validates the URL fetchOnce() is CALLED
  // with, so a redirect target never gets the private-hostname/DNS-pin
  // checks. Each hop is fetched manually and re-validated from scratch
  // through the same fetchOnce() before being followed.
  let currentUrl = url;
  const maxRedirects = 5;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetchOnce(currentUrl);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`URL returned HTTP ${res.status} with no redirect location`);
      }
      // Resolve relative Location headers against the current URL.
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`URL returned HTTP ${res.status}`);
    }

    const html = await res.text();
    // sanitizeInput() (shared @resumaker/ai-safety, used well beyond just
    // this call site) hard-rejects anything over 20k chars rather than
    // truncating — a deliberately strict default we shouldn't loosen
    // globally just for this one caller. Large ATS/job-board pages
    // regularly blow past 20k once stripped (nav, footer, "related jobs",
    // cookie banners), which was surfacing as a flat "JD rejected" even
    // though the actual posting is normally a few thousand chars near the
    // top of the page. Truncate here instead, ahead of the shared
    // sanitizer, scoped to this one call site.
    return stripHtml(html).slice(0, URL_FETCH_CHAR_LIMIT);
  }

  throw new Error('Too many redirects');
}

/** Minimal response shape fetchUrl() actually reads — status, one
 * header lookup, and the body as text. Lets fetchOnce() return
 * something call-compatible with a real fetch() Response without
 * pulling in more of that interface than this file needs. */
interface FetchOnceResult {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

// Hard cap on response body size while streaming, independent of the
// post-download URL_FETCH_CHAR_LIMIT truncation below (that slices
// *after* the full body is already in memory — this bounds memory use
// for a malicious or just enormous response before we ever get there).
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB

/** One SSRF-validated fetch attempt. Does not itself follow redirects —
 * returns a minimal Response-like object so fetchUrl() can inspect 30x
 * responses and re-validate the next hop before following it. */
async function fetchOnce(url: string): Promise<FetchOnceResult> {
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
  // resolution, so a bare private IP never reaches the request below.
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

  // SSRF: resolve DNS first AND pin the actual connection to that
  // resolved IP to defeat DNS rebinding — re-resolving at connect time
  // (what a plain fetch(url) does) would let a short-TTL rebinding
  // attack flip the IP between our check and the request.
  //
  // Pinning used to mean rewriting the request URL's hostname to the
  // IP and passing the original hostname as a `Host` header — that
  // closes the rebinding gap but breaks HTTPS against anything behind
  // a CDN/shared-IP front door (Greenhouse et al.): the TLS ClientHello's
  // SNI is derived from the URL you connect *to*, which was now a bare
  // IP, not the real hostname, so the edge either rejected the
  // handshake or routed to the wrong backend — indistinguishable from
  // "JD extraction just doesn't work" for those sites.
  //
  // Fix: keep the original hostname in the request (so SNI + the Host
  // header stay correct and certificate validation matches normally),
  // and instead override *DNS resolution itself* via a custom `lookup`
  // passed to node:http(s) — that only affects which IP the TCP socket
  // connects to, not what hostname TLS/HTTP think they're talking to.
  // fetch() has no hook for this (browsers don't expose one), which is
  // why this one call site uses node:http(s) directly instead.
  const pinnedIp = await resolveAndAssertPublic(parsed.hostname);
  const pinnedFamily = pinnedIp.includes(':') ? 6 : 4;
  const pinnedLookup = (
    _hostname: string,
    options: unknown,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | { address: string; family: number }[],
      family?: number,
    ) => void,
  ): void => {
    // dns.lookup's contract: when called with `{ all: true }`, the
    // callback takes an array of {address, family} and no 3rd arg;
    // otherwise a single (address, family) pair. node:http(s) invokes
    // whatever `lookup` function you pass following this same
    // contract, so a callback that always used the single-address
    // shape regardless of `options.all` broke as soon as it was
    // called the other way — surfaced as an opaque "Invalid IP
    // address: undefined" from deep in Node's own connection code.
    const wantsAll =
      typeof options === 'object' && options !== null && (options as { all?: boolean }).all;
    if (wantsAll) {
      callback(null, [{ address: pinnedIp, family: pinnedFamily }]);
    } else {
      callback(null, pinnedIp, pinnedFamily);
    }
  };

  const { request: httpsRequest } = await import('node:https');
  const { request: httpRequest } = await import('node:http');
  const requestFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise<FetchOnceResult>((resolve, reject) => {
    const req = requestFn(
      {
        hostname: parsed.hostname, // original — drives Host header + TLS SNI
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- node:http/https' own `lookup` option type is narrower than dns.lookup's; this matches it at the call site instead of fighting the type here.
        lookup: pinnedLookup as any,
        headers: {
          'User-Agent': 'ResumakerBot/1.0 (+https://resumaker.co.il)',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('Response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            headers: {
              get: (name: string) => {
                const value = res.headers[name.toLowerCase()];
                return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
              },
            },
            text: async () => Buffer.concat(chunks).toString('utf-8'),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
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
