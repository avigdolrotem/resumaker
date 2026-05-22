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

  // Prevent SSRF: block private IP ranges
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Private hosts not allowed');
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ResumakerBot/1.0 (+https://resumaker.co.il)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`URL returned HTTP ${res.status}`);
  }

  const html = await res.text();
  return stripHtml(html);
}

function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true; // link-local + AWS metadata
  return false;
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
