import type { NormalizedJob, FetchResult } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from '../html-utils';

const LIST_BASE = 'https://api.smartrecruiters.com/v1/companies/{slug}/postings';
const DETAIL_BASE = 'https://api.smartrecruiters.com/v1/companies/{slug}/postings/{id}';
// Verified live (visa/bosch/ikea/mckinsey all 200): the friendly slug
// from a company's public jobs.smartrecruiters.com/{Name} URL works
// directly as companyId — no separate opaque ID to resolve.
const DETAIL_CONCURRENCY = 5;

interface SmartRecruitersListItem {
  id: string;
  name?: string;
  company?: { name?: string; identifier?: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  releasedDate?: string;
}

interface SmartRecruitersListResponse {
  content?: SmartRecruitersListItem[];
}

interface SmartRecruitersDetail {
  postingUrl?: string;
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string } | undefined>;
  };
}

/**
 * The list endpoint (/postings) never includes the actual description —
 * verified live: it's summary fields only. The full text lives in the
 * per-posting detail endpoint's jobAd.sections (companyDescription /
 * jobDescription / qualifications / additionalInformation, each HTML),
 * so unlike Greenhouse/Recruitee this needs a second call per job.
 * Bounded concurrency to avoid hammering a company's board with N
 * simultaneous requests for a large postings list.
 */
async function fetchDetail(slug: string, id: string): Promise<SmartRecruitersDetail | null> {
  const url = DETAIL_BASE.replace('{slug}', slug).replace('{id}', id);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as SmartRecruitersDetail;
  } catch {
    return null;
  }
}

async function fetchDetailsInBatches(
  slug: string,
  items: SmartRecruitersListItem[],
): Promise<Map<string, SmartRecruitersDetail>> {
  const details = new Map<string, SmartRecruitersDetail>();
  for (let i = 0; i < items.length; i += DETAIL_CONCURRENCY) {
    const batch = items.slice(i, i + DETAIL_CONCURRENCY);
    const results = await Promise.all(batch.map((item) => fetchDetail(slug, item.id)));
    batch.forEach((item, idx) => {
      const detail = results[idx];
      if (detail) details.set(item.id, detail);
    });
  }
  return details;
}

/** Fetch all open jobs from a company's SmartRecruiters postings. */
export async function fetchSmartRecruitersJobs(companySlug: string): Promise<FetchResult> {
  const listUrl = LIST_BASE.replace('{slug}', companySlug);
  let listData: SmartRecruitersListResponse;
  try {
    const res = await fetch(listUrl, { signal: AbortSignal.timeout(20_000) });
    // Public postings feed is opt-in on SmartRecruiters' side (tier-
    // dependent) — a company without it enabled 404s here, same as any
    // other "this company doesn't publish this way" case.
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    listData = (await res.json()) as SmartRecruitersListResponse;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const items = listData.content ?? [];
  let details: Map<string, SmartRecruitersDetail>;
  try {
    details = await fetchDetailsInBatches(companySlug, items);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // flatMap-and-skip, not map-with-fallback: a posting whose detail
  // fetch failed has no description AND no postingUrl. Falling back to
  // `listUrl` gave every such posting the SAME urlNormalized, so two
  // failures in one board collided on jobs_url_norm_unique and took the
  // entire 500-row upsert batch down with them (upsertJobs batches, so
  // one bad pair loses every job from that company for the run).
  // A posting we couldn't read is better dropped this run and picked up
  // on the next one.
  const jobs = items.flatMap((item): NormalizedJob[] => {
    const detail = details.get(item.id);
    if (!detail?.postingUrl) return [];

    const loc = item.location;
    const location = [loc?.city, loc?.region, loc?.country].filter(Boolean).join(', ');
    const sections = detail.jobAd?.sections ?? {};
    const description = Object.values(sections)
      .map((s) => stripHtml(s?.text ?? ''))
      .filter(Boolean)
      .join('\n\n');
    const jobUrl = detail.postingUrl;
    return [
      {
        externalId: item.id,
        source: 'smartrecruiters',
        company: item.company?.name ?? companySlug,
        companySlug,
        title: item.name ?? '',
        location: location || undefined,
        description,
        url: jobUrl,
        // externalId folded in for the same reason greenhouse.ts does it
        // — two postings must never normalize to one row even if a board
        // serves an unexpected URL shape.
        urlNormalized: `${normalizeUrl(jobUrl)}#smartrecruiters-${item.id}`,
        remote: loc?.remote ?? false,
        seniority: inferSeniority(item.name ?? ''),
        postedAt: parseIsoDate(item.releasedDate),
        rawData: item,
      },
    ];
  });
  return { ok: true, jobs };
}
