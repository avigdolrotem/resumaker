import type { NormalizedJob } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority } from '../html-utils';
import { fetchRecruiteeJobs } from './recruitee';
import { fetchSmartRecruitersJobs } from './smartrecruiters';

const SERPER_URL = 'https://google.serper.dev/search';

/**
 * Discovery queries, not the fetch itself — Serper's /search (organic
 * results) is used purely to find greenhouse.io / lever.co /
 * apply.workable.com URLs for companies not in the curated company
 * lists; the actual job data always comes from each ATS's own public
 * API afterward (fetchSingle{Greenhouse,Lever,Workable}Job below), never
 * from anything Google's result snippet says. That's also why this
 * doesn't scrape Google's result *pages* directly (a ToS violation, and
 * a fast way to get an IP banned) — Serper is a paid, ToS-compliant API
 * wrapper around the same search.
 *
 * Small, fixed list: each query costs 1 Serper credit (free tier: 2,500/
 * month), and one run through all of these plus a daily cron cadence
 * stays comfortably inside that.
 */
const QUERIES = [
  'software engineer Israel site:greenhouse.io OR site:lever.co OR site:workable.com',
  'backend developer Tel Aviv site:greenhouse.io OR site:lever.co',
  'frontend developer Israel site:greenhouse.io OR site:lever.co',
  'DevOps engineer Israel site:greenhouse.io OR site:lever.co',
  'data engineer Israel site:greenhouse.io OR site:lever.co',
  'cybersecurity engineer Israel site:greenhouse.io OR site:lever.co',
  'machine learning engineer Israel site:greenhouse.io OR site:lever.co',
  'product manager Israel tech site:greenhouse.io OR site:lever.co',
];

// Separate query batch for the two board-fetch (not single-job) sources
// below — same discovery mechanism, different resolution strategy (see
// the per-source comment in the results loop).
const BOARD_DISCOVERY_QUERIES = [
  'jobs Israel site:recruitee.com',
  'jobs Tel Aviv site:recruitee.com',
  'jobs Israel site:jobs.smartrecruiters.com',
];

const GH_RE = /greenhouse\.io\/([A-Za-z0-9_-]+)\/jobs\/(\d+)/i;
const LV_RE = /jobs\.lever\.co\/([A-Za-z0-9_-]+)\/([0-9a-f-]{36})/i;
const WK_RE = /apply\.workable\.com\/([A-Za-z0-9_-]+)\/j\/([A-Za-z0-9]+)/i;
const RC_RE = /^https:\/\/([a-z0-9-]+)\.recruitee\.com\//i;
const SR_RE = /jobs\.smartrecruiters\.com\/([A-Za-z0-9_-]+)\//i;

interface SerperOrganicResult {
  link?: string;
}
interface SerperResponse {
  organic?: SerperOrganicResult[];
}

// Single-job variants of the boards-listing endpoints in greenhouse.ts/
// lever.ts/workable.ts — Serper discovers one specific posting URL at a
// time, not a whole company board, so the bulk fetchers don't fit here.
// Deliberately not sharing a helper with those three: the field mapping
// is a handful of lines each and duplicating it is cheaper than adding
// cross-file coupling to already-shipped, independently-tested fetchers
// for what's a fairly small amount of overlap.

async function fetchSingleGreenhouseJob(
  slug: string,
  jobId: string,
): Promise<NormalizedJob | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${jobId}?questions=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const job = (await res.json()) as {
      id?: number;
      title?: string;
      absolute_url?: string;
      content?: string;
      company?: { name?: string };
      location?: { name?: string };
    };
    const location = job.location?.name ?? '';
    const jobUrl = job.absolute_url ?? url;
    return {
      externalId: String(job.id ?? jobId),
      source: 'greenhouse',
      // Unlike the bulk boards endpoint (which has the company name at
      // the response's top level), the single-job endpoint's `company`
      // field is genuinely null — verified live against a real posting,
      // not assumed. Same title-case-the-slug fallback the bulk lever.ts/
      // workable.ts fetchers already use for this exact situation.
      company: job.company?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
      companySlug: slug,
      title: job.title ?? '',
      location: location || undefined,
      description: stripHtml(job.content ?? ''),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: location.toLowerCase().includes('remote'),
      seniority: inferSeniority(job.title ?? ''),
      rawData: job,
    };
  } catch {
    return null;
  }
}

async function fetchSingleLeverJob(slug: string, jobId: string): Promise<NormalizedJob | null> {
  const url = `https://api.lever.co/v0/postings/${slug}/${jobId}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const job = (await res.json()) as {
      id?: string;
      text?: string;
      hostedUrl?: string;
      descriptionPlain?: string;
      description?: string;
      categories?: { location?: string };
    };
    const location = job.categories?.location ?? '';
    const jobUrl = job.hostedUrl ?? url;
    return {
      externalId: job.id ?? jobId,
      source: 'lever',
      company: slug.charAt(0).toUpperCase() + slug.slice(1),
      companySlug: slug,
      title: job.text ?? '',
      location: location || undefined,
      description: stripHtml(job.descriptionPlain ?? job.description ?? ''),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: location.toLowerCase().includes('remote'),
      seniority: inferSeniority(job.text ?? ''),
      rawData: job,
    };
  } catch {
    return null;
  }
}

// Not a GET-by-shortcode endpoint like Greenhouse/Lever — verified live
// that apply.workable.com/api/v3/accounts/{slug}/jobs/{shortcode} 404s
// (the pattern job-app/backend/app/sources/serper.py used, evidently no
// longer valid). What does work — also verified live — is Workable's
// public widget endpoint: it returns the whole company's jobs *with*
// full HTML descriptions in one call, which the bulk board-listing
// endpoint (workable.ts) never includes. Fetch that and pick out the
// one job whose shortcode matches what Serper found.
async function fetchSingleWorkableJob(
  slug: string,
  shortcode: string,
): Promise<NormalizedJob | null> {
  const url = `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      jobs?: Array<{
        shortcode?: string;
        title?: string;
        description?: string;
        city?: string;
        country?: string;
        telecommuting?: boolean;
      }>;
    };
    const job = data.jobs?.find((j) => j.shortcode === shortcode);
    if (!job) return null;
    const location = [job.city, job.country].filter(Boolean).join(', ') || undefined;
    // Matches workable.ts's URL convention (the widget's own `url` field
    // is a slug-less /j/{shortcode} shortlink that redirects here anyway
    // — verified live — so building it directly avoids a hop and keeps
    // urlNormalized identical to what the bulk crawler would produce for
    // the same job).
    const jobUrl = `https://apply.workable.com/${slug}/j/${shortcode}`;
    return {
      externalId: shortcode,
      source: 'workable',
      company: data.name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
      companySlug: slug,
      title: job.title ?? '',
      location,
      description: stripHtml(job.description ?? ''),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: job.telecommuting ?? false,
      seniority: inferSeniority(job.title ?? ''),
      rawData: job,
    };
  } catch {
    return null;
  }
}

export interface SerperDiscoveryResult {
  /** Jobs found, tagged with their *true* ATS source (greenhouse/lever/
   *  workable) — never 'serper' — so they dedupe naturally against the
   *  curated-list crawls via the same (source, externalId) constraint. */
  jobs: NormalizedJob[];
  queriesRun: number;
  queryErrors: string[];
}

/**
 * Run the discovery queries and resolve every Greenhouse/Lever/Workable
 * URL Serper's organic results surface into a real, structured job via
 * that ATS's own public API — no SERP content is ever stored. Returns []
 * jobs (not a throw) if apiKey is empty, matching every other
 * optional-key source in this package (silently skipped when unconfigured).
 *
 * Deliberately does NOT participate in closure detection — a company
 * this run's queries didn't happen to surface says nothing about whether
 * that company's jobs are still open; only a source with a *complete*
 * fetch of a company's board (the curated-list crawlers) is a fit
 * closure signal. Callers should upsert these jobs but skip sweeping on
 * their behalf.
 */
async function runQuery(
  apiKey: string,
  query: string,
): Promise<{ links: string[]; error?: string }> {
  try {
    const res = await fetch(SERPER_URL, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, hl: 'en', num: 10 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { links: [], error: `${query}:HTTP ${res.status}` };
    const data = (await res.json()) as SerperResponse;
    return { links: (data.organic ?? []).map((item) => item.link ?? '') };
  } catch (err) {
    return { links: [], error: `${query}:${(err as Error).message}` };
  }
}

export async function discoverJobsViaSerper(apiKey: string): Promise<SerperDiscoveryResult> {
  if (!apiKey) return { jobs: [], queriesRun: 0, queryErrors: [] };

  const seen = new Set<string>(); // `${source}:${externalId}` — dedup within this run
  const jobs: NormalizedJob[] = [];
  const queryErrors: string[] = [];
  let queriesRun = 0;

  for (const query of QUERIES) {
    const { links, error } = await runQuery(apiKey, query);
    if (error) {
      queryErrors.push(error);
      continue;
    }
    queriesRun++;

    for (const link of links) {
      const gh = GH_RE.exec(link);
      if (gh?.[1] && gh[2]) {
        const slug = gh[1].toLowerCase();
        const key = `greenhouse:${gh[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const job = await fetchSingleGreenhouseJob(slug, gh[2]);
        if (job) jobs.push(job);
        continue;
      }

      const lv = LV_RE.exec(link);
      if (lv?.[1] && lv[2]) {
        const slug = lv[1].toLowerCase();
        const key = `lever:${lv[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const job = await fetchSingleLeverJob(slug, lv[2]);
        if (job) jobs.push(job);
        continue;
      }

      const wk = WK_RE.exec(link);
      if (wk?.[1] && wk[2]) {
        const slug = wk[1].toLowerCase();
        const key = `workable:${wk[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const job = await fetchSingleWorkableJob(slug, wk[2]);
        if (job) jobs.push(job);
      }
    }
  }

  // Recruitee/SmartRecruiters: unlike the three above, there's no
  // single-job endpoint worth using — each company's full board is one
  // cheap call (recruitee.ts) or a small bounded-concurrency batch
  // (smartrecruiters.ts) that returns everything at once, so once a
  // company is discovered here it's worth fetching completely rather
  // than resolving just the one posting Serper happened to surface.
  // fetchedBoards prevents doing that twice if multiple links from the
  // same company appear across these queries.
  const fetchedBoards = new Set<string>(); // `${source}:${slug}`
  for (const query of BOARD_DISCOVERY_QUERIES) {
    const { links, error } = await runQuery(apiKey, query);
    if (error) {
      queryErrors.push(error);
      continue;
    }
    queriesRun++;

    for (const link of links) {
      const rc = RC_RE.exec(link);
      if (rc?.[1]) {
        const slug = rc[1].toLowerCase();
        const key = `recruitee:${slug}`;
        if (fetchedBoards.has(key)) continue;
        fetchedBoards.add(key);
        const result = await fetchRecruiteeJobs(slug);
        if (result.ok) {
          for (const job of result.jobs) {
            const jobKey = `recruitee:${job.externalId}`;
            if (seen.has(jobKey)) continue;
            seen.add(jobKey);
            jobs.push(job);
          }
        }
        continue;
      }

      const sr = SR_RE.exec(link);
      if (sr?.[1]) {
        const slug = sr[1];
        const key = `smartrecruiters:${slug}`;
        if (fetchedBoards.has(key)) continue;
        fetchedBoards.add(key);
        const result = await fetchSmartRecruitersJobs(slug);
        if (result.ok) {
          for (const job of result.jobs) {
            const jobKey = `smartrecruiters:${job.externalId}`;
            if (seen.has(jobKey)) continue;
            seen.add(jobKey);
            jobs.push(job);
          }
        }
      }
    }
  }

  return { jobs, queriesRun, queryErrors };
}
