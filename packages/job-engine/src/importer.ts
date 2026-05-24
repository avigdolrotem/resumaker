import type Anthropic from '@anthropic-ai/sdk';
import type { NormalizedJob } from './types';
import { normalizeUrl } from './url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from './html-utils';

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

// Tool schema for structured extraction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EXTRACT_TOOL: any = {
  name: 'extract_job',
  description: 'Output structured job data extracted from the content',
  input_schema: {
    type: 'object',
    required: ['company', 'title', 'remote', 'description'],
    properties: {
      company: { type: 'string' },
      title: { type: 'string' },
      location: { type: ['string', 'null'] },
      remote: { type: 'boolean' },
      description: { type: 'string' },
      requirements: { type: 'array', items: { type: 'string' } },
      nice_to_have: { type: 'array', items: { type: 'string' } },
      compensation: { type: ['string', 'null'] },
      posted_at: { type: ['string', 'null'] },
      application_url: { type: ['string', 'null'] },
    },
  },
};

interface ExtractedJob {
  company: string;
  title: string;
  location?: string | null;
  remote: boolean;
  description: string;
  requirements?: string[];
  nice_to_have?: string[];
  compensation?: string | null;
  posted_at?: string | null;
  application_url?: string | null;
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text.slice(0, 20_000);
}

async function extractJobData(content: string, anthropic: Anthropic): Promise<ExtractedJob | null> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: EXTRACT_JD_SYSTEM,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_job' },
    messages: [
      { role: 'user', content: `Extract job information:\n\n${content.slice(0, 12_000)}` },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'extract_job',
  );
  return toolUse ? (toolUse.input as ExtractedJob) : null;
}

/**
 * Fetch a job posting URL and use Claude haiku to extract structured job data.
 * Returns a NormalizedJob with source="manual".
 */
export async function importJobFromUrl(url: string, anthropic: Anthropic): Promise<NormalizedJob> {
  let content = '';
  try {
    content = await fetchUrlText(url);
  } catch {
    // Proceed with empty content — Claude will still attempt extraction
  }

  const data = await extractJobData(content, anthropic);
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
