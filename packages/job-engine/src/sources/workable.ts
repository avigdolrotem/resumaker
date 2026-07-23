import type { NormalizedJob, FetchResult } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority } from '../html-utils';

const BASE = 'https://apply.workable.com/api/v3/accounts/{slug}/jobs';

interface WorkableJob {
  shortcode?: string;
  id?: string;
  title?: string;
  city?: string;
  country?: string;
  remote?: boolean;
  description?: string;
  company?: { name?: string };
}

interface WorkableResponse {
  results?: WorkableJob[];
}

/** Fetch all open jobs from a company's Workable board. */
export async function fetchWorkableJobs(companySlug: string): Promise<FetchResult> {
  const url = BASE.replace('{slug}', companySlug);
  let data: WorkableResponse;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', location: [] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    data = (await res.json()) as WorkableResponse;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const jobs = (data.results ?? []).map((job): NormalizedJob => {
    const locationParts = [job.city, job.country].filter(Boolean);
    const location = locationParts.join(', ') || undefined;
    const shortcode = job.shortcode ?? job.id ?? '';
    const jobUrl = `https://apply.workable.com/${companySlug}/j/${shortcode}`;
    return {
      externalId: shortcode,
      source: 'workable',
      company: job.company?.name ?? companySlug.charAt(0).toUpperCase() + companySlug.slice(1),
      companySlug,
      title: job.title ?? '',
      location,
      description: stripHtml(job.description ?? ''),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: job.remote ?? false,
      seniority: inferSeniority(job.title ?? ''),
      rawData: job,
    };
  });
  return { ok: true, jobs };
}
