import type { NormalizedJob } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from '../html-utils';

const BASE = 'https://api.lever.co/v0/postings/{slug}?mode=json';

interface LeverPosting {
  id?: string;
  text?: string;
  hostedUrl?: string;
  descriptionPlain?: string;
  description?: string;
  createdAt?: number;
  categories?: { location?: string };
}

/** Fetch all open postings from a company's Lever board. Returns [] on error. */
export async function fetchLeverJobs(companySlug: string): Promise<NormalizedJob[]> {
  const url = BASE.replace('{slug}', companySlug);
  let postings: LeverPosting[];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    postings = (await res.json()) as LeverPosting[];
  } catch {
    return [];
  }

  return postings.map((job): NormalizedJob => {
    const location = job.categories?.location ?? '';
    const jobUrl = job.hostedUrl ?? '';
    const rawDesc = job.descriptionPlain ?? job.description ?? '';
    return {
      externalId: job.id ?? '',
      source: 'lever',
      company: companySlug.charAt(0).toUpperCase() + companySlug.slice(1),
      companySlug,
      title: job.text ?? '',
      location: location || undefined,
      description: stripHtml(rawDesc),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: location.toLowerCase().includes('remote'),
      seniority: inferSeniority(job.text ?? ''),
      postedAt: parseIsoDate(job.createdAt),
      rawData: job,
    };
  });
}
