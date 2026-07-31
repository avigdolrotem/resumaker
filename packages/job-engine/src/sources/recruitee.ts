import type { NormalizedJob, FetchResult } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from '../html-utils';

const BASE = 'https://{slug}.recruitee.com/api/offers';

interface RecruiteeOffer {
  id: number;
  slug?: string;
  title?: string;
  company_name?: string;
  city?: string;
  country?: string;
  remote?: boolean;
  hybrid?: boolean;
  description?: string;
  requirements?: string;
  careers_url?: string;
  updated_at?: string;
}

interface RecruiteeResponse {
  offers?: RecruiteeOffer[];
}

/**
 * Fetch all open jobs from a company's Recruitee careers site — a single
 * public, unauthenticated call, same shape as Greenhouse. Verified live
 * (thecareersteam.recruitee.com): careers_url is already the canonical
 * public posting URL (sometimes on the company's own custom domain, not
 * recruitee.com), so it's used directly rather than reconstructed.
 */
export async function fetchRecruiteeJobs(companySlug: string): Promise<FetchResult> {
  const url = BASE.replace('{slug}', companySlug);
  let data: RecruiteeResponse;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    data = (await res.json()) as RecruiteeResponse;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const jobs = (data.offers ?? []).map((offer): NormalizedJob => {
    const location = [offer.city, offer.country].filter(Boolean).join(', ');
    const jobUrl = offer.careers_url ?? url;
    const description = stripHtml(offer.description ?? '');
    const requirements = stripHtml(offer.requirements ?? '');
    return {
      externalId: String(offer.id),
      source: 'recruitee',
      company: offer.company_name ?? companySlug,
      companySlug,
      title: offer.title ?? '',
      location: location || undefined,
      description: [description, requirements].filter(Boolean).join('\n\n'),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: Boolean(offer.remote || offer.hybrid),
      seniority: inferSeniority(offer.title ?? ''),
      postedAt: parseIsoDate(offer.updated_at),
      rawData: offer,
    };
  });
  return { ok: true, jobs };
}
