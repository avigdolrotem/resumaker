import type { NormalizedJob, FetchResult } from '../types';
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

/** Fetch all open postings from a company's Lever board. */
export async function fetchLeverJobs(companySlug: string): Promise<FetchResult> {
  const url = BASE.replace('{slug}', companySlug);
  let postings: LeverPosting[];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    postings = (await res.json()) as LeverPosting[];
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const jobs = postings.map((job): NormalizedJob => {
    const location = job.categories?.location ?? '';
    const jobUrl = job.hostedUrl ?? '';
    const rawDesc = job.descriptionPlain ?? job.description ?? '';
    // See greenhouse.ts's equivalent comment — description(Plain) is
    // already captured (stripped) below; don't duplicate it in rawData.
    const { descriptionPlain: _dp, description: _d, ...rawDataRest } = job;
    const externalId = job.id ?? '';
    return {
      externalId,
      source: 'lever',
      company: companySlug.charAt(0).toUpperCase() + companySlug.slice(1),
      companySlug,
      title: job.text ?? '',
      location: location || undefined,
      description: stripHtml(rawDesc),
      url: jobUrl,
      // Fold in externalId so two postings can never collide onto the
      // same urlNormalized regardless of URL shape — see greenhouse.ts
      // for the live-verified collision this prevents.
      urlNormalized: `${normalizeUrl(jobUrl)}#lever-${externalId}`,
      remote: location.toLowerCase().includes('remote'),
      seniority: inferSeniority(job.text ?? ''),
      postedAt: parseIsoDate(job.createdAt),
      rawData: rawDataRest,
    };
  });
  return { ok: true, jobs };
}
