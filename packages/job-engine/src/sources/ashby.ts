import type { NormalizedJob } from '../types';
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

/** Fetch all open postings from a company's Ashby job board. Returns [] on error. */
export async function fetchAshbyJobs(companySlug: string): Promise<NormalizedJob[]> {
  let data: AshbyResponse;
  try {
    const res = await fetch(
      `${BASE}?organizationHostedJobsPageName=${encodeURIComponent(companySlug)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return [];
    data = (await res.json()) as AshbyResponse;
  } catch {
    return [];
  }

  const companyName =
    data.jobBoard?.title ?? companySlug.charAt(0).toUpperCase() + companySlug.slice(1);

  return (data.jobPostings ?? []).map((job): NormalizedJob => {
    const location = job.locationName ?? '';
    const jobUrl = job.applicationLink ?? job.externalLink ?? '';
    return {
      externalId: job.id ?? '',
      source: 'ashby',
      company: companyName,
      companySlug,
      title: job.title ?? '',
      location: location || undefined,
      description: stripHtml(job.descriptionHtml ?? ''),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: job.isRemote ?? false,
      seniority: inferSeniority(job.title ?? ''),
      postedAt: parseIsoDate(job.publishedDate),
      rawData: job,
    };
  });
}
