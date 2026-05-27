import { generateObject } from 'ai';
import { vertex } from '@ai-sdk/google-vertex';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { z } from 'zod';
import { lookup as dnsLookup } from 'node:dns/promises';

/** Resolve `provider/model` to a Vertex-backed AI SDK model. */
function resolveModel(modelString: string) {
  const slash = modelString.indexOf('/');
  if (slash === -1) throw new Error(`Invalid model string "${modelString}"`);
  const provider = modelString.slice(0, slash);
  const modelId = modelString.slice(slash + 1);
  if (provider === 'anthropic') return vertexAnthropic(modelId);
  if (provider === 'google') return vertex(modelId);
  throw new Error(`Unsupported provider "${provider}"`);
}
import type { NormalizedJob } from './types';
import { normalizeUrl } from './url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from './html-utils';

const MAX_FETCH_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECTS = 5;

/**
 * Block hosts that resolve to private / link-local / loopback / metadata
 * addresses. Defense against SSRF where an attacker submits a URL that
 * fronts an internal service (Cloud SQL, Memorystore, GCE metadata).
 *
 * Resolves the hostname, checks every returned IP. We re-resolve at each
 * redirect hop — not a perfect DNS-rebinding mitigation (a fast TTL=0
 * record could still flip between resolve and connect), but it raises
 * the bar considerably.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  // Numeric / hex / octal IP literals — let dns.lookup normalize them.
  const addrs = await dnsLookup(hostname, { all: true });
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new Error(`Blocked private/internal address: ${hostname} → ${a.address}`);
    }
  }
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1' || ip === '127.0.0.1' || ip === '0.0.0.0') {
    return true;
  }
  if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd')) return true;
  if (ip.includes(':')) {
    // IPv6: also block ::ffff:10.x and similar IPv4-mapped private ranges
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateIp(mapped[1]);
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed → block
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — GCE metadata, link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // multicast + reserved
  return false;
}

async function fetchUrlText(url: string): Promise<string> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Blocked protocol: ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    const res = await fetch(current, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumakerBot/1.0)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Redirect without Location');
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Defensive content-length check before streaming the body.
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_FETCH_BYTES) {
      throw new Error(`Response too large: ${declared} bytes`);
    }

    const reader = res.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let total = 0;
    let out = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FETCH_BYTES) {
        await reader.cancel();
        throw new Error('Response exceeded size cap');
      }
      out += decoder.decode(value, { stream: true });
      if (out.length > 20_000) break;
    }
    return out.slice(0, 20_000);
  }
  throw new Error('Too many redirects');
}

const EXTRACT_JD_SYSTEM = `You are a job description parser. Extract structured information from the given job description text or URL content.

Return ONLY a JSON object with these exact fields (use null for missing fields):
{
  "company": "Company name",
  "title": "Job title",
  "location": "Location (city, country) or 'Remote'",
  "remote": true/false,
  "description": "Full job description text (cleaned, no HTML)",
  "requirements": ["requirement 1", "requirement 2"],
  "nice_to_have": ["nice to have 1"],
  "compensation": "Salary range if mentioned, else null",
  "posted_at": "ISO date string if mentioned, else null",
  "application_url": "Direct application URL if different from source"
}

Rules:
- Strip all HTML tags from description
- Keep requirements as individual bullet points
- If location mentions Israel (ישראל, Tel Aviv, Jerusalem, etc.) set location accordingly
- Detect remote from keywords: remote, hybrid, work from home, WFH
- Return valid JSON only, no markdown fences`;

const ExtractJobSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable().optional(),
  remote: z.boolean(),
  description: z.string(),
  requirements: z.array(z.string()).optional(),
  nice_to_have: z.array(z.string()).optional(),
  compensation: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  application_url: z.string().nullable().optional(),
});

type ExtractedJob = z.infer<typeof ExtractJobSchema>;

async function extractJobData(content: string, modelString: string): Promise<ExtractedJob | null> {
  const result = await generateObject({
    model: resolveModel(modelString),
    schema: ExtractJobSchema,
    maxOutputTokens: 2048,
    system: EXTRACT_JD_SYSTEM,
    prompt: `Extract job information:\n\n${content.slice(0, 12_000)}`,
  });
  return result.object;
}

/**
 * Fetch a job posting URL and use an LLM (default:
 * anthropic/claude-haiku-4-5@20251001) to extract structured job data.
 * Returns a NormalizedJob with source="manual".
 */
export async function importJobFromUrl(
  url: string,
  modelString = 'anthropic/claude-haiku-4-5@20251001',
): Promise<NormalizedJob> {
  let content = '';
  try {
    content = await fetchUrlText(url);
  } catch {
    // Proceed with empty content — the LLM will still attempt extraction
  }

  const data = await extractJobData(content, modelString);
  const effectiveUrl = data?.application_url ?? url; // application_url is string|null — null falls through to url
  const externalId = normalizeUrl(url) || `manual-${Math.abs(hashStr(content)) & 0xffffff}`;

  return {
    externalId,
    source: 'manual',
    company: data?.company ?? 'Unknown',
    companySlug: (data?.company ?? 'unknown').toLowerCase().replace(/\s+/g, '-'),
    title: data?.title ?? 'Unknown Position',
    location: data?.location ?? undefined, // null-to-undefined coercion handled by ?? undefined
    description: data?.description ? stripHtml(data.description) : content.slice(0, 5_000),
    url: effectiveUrl,
    urlNormalized: normalizeUrl(effectiveUrl),
    remote: data?.remote ?? false,
    seniority: inferSeniority(data?.title ?? ''),
    postedAt: parseIsoDate(data?.posted_at ?? undefined),
    rawData: data ?? undefined,
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
