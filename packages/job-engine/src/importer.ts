import { generateObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
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

async function extractJobData(content: string, modelString: string): Promise<ExtractedJob | null> {
  const result = await generateObject({
    model: gateway(modelString),
    schema: ExtractJobSchema,
    maxOutputTokens: 2048,
    system: EXTRACT_JD_SYSTEM,
    prompt: `Extract job information:\n\n${content.slice(0, 12_000)}`,
  });
  return result.object;
}

/**
 * Fetch a job posting URL and use an LLM (default: anthropic/claude-haiku-4-5)
 * to extract structured job data.  Returns a NormalizedJob with source="manual".
 */
export async function importJobFromUrl(
  url: string,
  modelString = 'anthropic/claude-haiku-4-5',
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
