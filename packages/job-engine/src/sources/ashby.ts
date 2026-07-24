import type { NormalizedJob, FetchResult } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from '../html-utils';

const BASE = 'https://jobs.ashbyhq.com/api/non-user-facing/job-board/job-list';

interface AshbyPosting {
  id?: string;
  title?: string;
  locationName?: string;
  descriptionHtml?: string;
  applicationLink?: string;
  externalLink?: string;
  isRemote?: boolean;
  publishedDate?: string;
}

interface AshbyResponse {
  jobBoard?: { title?: string };
  jobPostings?: AshbyPosting[];
}

/** Fetch all open postings from a company's Ashby job board. */
export async function fetchAshbyJobs(companySlug: string): Promise<FetchResult> {
  let data: AshbyResponse;
  try {
    const res = await fetch(
      `${BASE}?organizationHostedJobsPageName=${encodeURIComponent(companySlug)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    data = (await res.json()) as AshbyResponse;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const companyName =
    data.jobBoard?.title ?? companySlug.charAt(0).toUpperCase() + companySlug.slice(1);

  const jobs = (data.jobPostings ?? []).map((job): NormalizedJob => {
    const location = job.locationName ?? '';
    const jobUrl = job.applicationLink ?? job.externalLink ?? '';
    // See greenhouse.ts's equivalent comment — descriptionHtml is
    // already captured (stripped) below; don't duplicate it in rawData.
    const { descriptionHtml: _dh, ...rawDataRest } = job;
    const externalId = job.id ?? '';
    return {
      externalId,
      source: 'ashby',
      company: companyName,
      companySlug,
      title: job.title ?? '',
      location: location || undefined,
      description: stripHtml(job.descriptionHtml ?? ''),
      url: jobUrl,
      // Fold in externalId so two postings can never collide onto the
      // same urlNormalized regardless of URL shape — see greenhouse.ts
      // for the live-verified collision this prevents. applicationLink
      // is an external URL (ATS-hosted or the company's own domain),
      // not something this fetcher constructs itself, so the same risk
      // applies here as it did for Greenhouse.
      urlNormalized: `${normalizeUrl(jobUrl)}#ashby-${externalId}`,
      remote: job.isRemote ?? false,
      seniority: inferSeniority(job.title ?? ''),
      postedAt: parseIsoDate(job.publishedDate),
      rawData: rawDataRest,
    };
  });
  return { ok: true, jobs };
}
