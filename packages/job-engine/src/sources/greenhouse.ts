import type { NormalizedJob, FetchResult } from '../types';
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

/** Fetch all open jobs from a company's Greenhouse board. */
export async function fetchGreenhouseJobs(companySlug: string): Promise<FetchResult> {
  const url = BASE.replace('{slug}', companySlug);
  let data: GreenhouseResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    data = (await res.json()) as GreenhouseResponse;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const jobs = (data.jobs ?? []).map((job): NormalizedJob => {
    const location = job.location?.name ?? '';
    const jobUrl = job.absolute_url ?? '';
    // rawData excludes `content` — the full-fidelity HTML is already
    // captured (stripped) in `description` below, and rawData is never
    // read back anywhere downstream. Pure storage bloat otherwise
    // (verified: cut the average row size by ~59% across a real
    // ~2k-job Greenhouse fetch).
    const { content: _content, ...rawDataRest } = job;
    const externalId = String(job.id);
    return {
      externalId,
      source: 'greenhouse',
      company: data.name ?? companySlug,
      companySlug,
      title: job.title ?? '',
      location: location || undefined,
      description: stripHtml(job.content ?? ''),
      url: jobUrl,
      // Most Greenhouse boards encode the job id in the URL path
      // (safe to normalize away query params/tracking junk), but
      // some companies embed Greenhouse on their own domain with the
      // id in a query param instead (verified live: JFrog's
      // join.jfrog.com/job?job=<id> — every posting there normalizes
      // to the same bare join.jfrog.com/job, which threw a real
      // jobs_url_norm_unique violation the moment two such jobs
      // landed in the same fetch). Same fix as taasuka.ts: fold the
      // externalId in so distinct jobs can never collide here,
      // regardless of which URL shape a given board uses. Re-scrapes
      // still land on the same value since externalId is stable.
      urlNormalized: `${normalizeUrl(jobUrl)}#greenhouse-${externalId}`,
      remote: location.toLowerCase().includes('remote'),
      seniority: inferSeniority(job.title ?? ''),
      postedAt: parseIsoDate(job.updated_at),
      rawData: rawDataRest,
    };
  });
  return { ok: true, jobs };
}
