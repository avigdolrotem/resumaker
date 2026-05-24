import type { NormalizedJob } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from '../html-utils';

const BASE = 'https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true';

interface GreenhouseJob {
  id: number;
  title?: string;
  absolute_url?: string;
  content?: string;
  updated_at?: string;
  location?: { name?: string };
}

interface GreenhouseResponse {
  name?: string;
  jobs?: GreenhouseJob[];
}

/** Fetch all open jobs from a company's Greenhouse board. Returns [] on error. */
export async function fetchGreenhouseJobs(companySlug: string): Promise<NormalizedJob[]> {
  const url = BASE.replace('{slug}', companySlug);
  let data: GreenhouseResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    data = (await res.json()) as GreenhouseResponse;
  } catch {
    return [];
  }

  return (data.jobs ?? []).map((job): NormalizedJob => {
    const location = job.location?.name ?? '';
    const jobUrl = job.absolute_url ?? '';
    return {
      externalId: String(job.id),
      source: 'greenhouse',
      company: data.name ?? companySlug,
      companySlug,
      title: job.title ?? '',
      location: location || undefined,
      description: stripHtml(job.content ?? ''),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: location.toLowerCase().includes('remote'),
      seniority: inferSeniority(job.title ?? ''),
      postedAt: parseIsoDate(job.updated_at),
      rawData: job,
    };
  });
}
