import type { NormalizedJob, FetchResult } from '../types';
import { normalizeUrl } from '../url-normalize';
import { stripHtml, inferSeniority, parseIsoDate } from '../html-utils';

const POSITIONS_BASE = 'https://www.comeet.co/careers-api/2.0/company/{uid}/positions';
const APPLY_BASE = 'https://www.comeet.com/jobs/{slug}/{positionUid}';

interface ComeetPosition {
  uid?: string;
  name?: string;
  company_name?: string;
  city?: string;
  country?: string;
  work_type?: string;
  details?: { description?: string; requirements?: string };
  time_updated?: number | string;
}

/**
 * Fetch all open positions from a company's Comeet board. Unlike the
 * other ATS sources, Comeet requires a per-company token (enforced since
 * 2025) — see harvestComeetToken below for where that comes from.
 */
export async function fetchComeetJobs(
  companySlug: string,
  companyUid: string,
  token: string,
): Promise<FetchResult> {
  const url = `${POSITIONS_BASE.replace('{uid}', companyUid)}?token=${encodeURIComponent(token)}`;
  let positions: ComeetPosition[];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data: unknown = await res.json();
    if (!Array.isArray(data))
      return { ok: false, error: 'unexpected response shape (not an array)' };
    positions = data as ComeetPosition[];
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const jobs = positions.map((pos): NormalizedJob => {
    const location = [pos.city, pos.country].filter(Boolean).join(', ') || undefined;
    const positionUid = pos.uid ?? '';
    const jobUrl = APPLY_BASE.replace('{slug}', companySlug).replace('{positionUid}', positionUid);
    const description = stripHtml(pos.details?.description ?? '');
    const requirements = stripHtml(pos.details?.requirements ?? '');
    const workType = (pos.work_type ?? '').toLowerCase();
    // See greenhouse.ts's equivalent comment — details.description and
    // .requirements are already fully captured (stripped) below; don't
    // duplicate them in rawData.
    const { details: _details, ...rawDataRest } = pos;
    return {
      externalId: positionUid,
      source: 'comeet',
      company: pos.company_name ?? companySlug,
      companySlug,
      title: pos.name ?? '',
      location,
      description: [description, requirements].filter(Boolean).join('\n\n'),
      url: jobUrl,
      urlNormalized: normalizeUrl(jobUrl),
      remote: workType === 'remote' || workType === 'hybrid',
      seniority: inferSeniority(pos.name ?? ''),
      postedAt: parseIsoDate(pos.time_updated),
      rawData: rawDataRest,
    };
  });
  return { ok: true, jobs };
}

/**
 * Find a balanced-brace JSON object starting at the first `{` after
 * `marker` in `text`. A regex like `/COMPANY_DATA = (\{.*?\});/` looks
 * simpler but breaks the moment the embedded JSON contains a `};`
 * substring anywhere inside a string value (a job description mentioning
 * code, for instance) — this walks brace depth character-by-character,
 * correctly skipping over `{`/`}` that appear inside quoted strings, so
 * it finds the actual matching close brace instead of the first one that
 * happens to look plausible.
 */
function extractBalancedJson(text: string, marker: string): string | null {
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;
  const start = text.indexOf('{', markerIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Comeet's own hosted careers page (https://www.comeet.com/jobs/{slug}/{uid})
 * embeds a `COMPANY_DATA = {...}` object directly in its HTML that powers
 * the public embeddable careers widget — including the same per-company
 * API token the positions endpoint requires. This is client-visible data
 * shipped to every visitor's browser by design (the token only grants
 * read access to that one company's own public job listings, the exact
 * thing the page itself displays) — not a bypass of anything private.
 *
 * Returns null on any failure (wrong/stale slug+uid — the company may
 * have left Comeet or renamed — network error, or unexpected page shape)
 * so a bad entry in the company list can't crash a bulk harvest run.
 * Also the re-harvest path when a stored token starts 401ing (Comeet
 * rotates these occasionally per the prior project's notes).
 */
export async function harvestComeetToken(
  companySlug: string,
  companyUid: string,
): Promise<string | null> {
  const url = `https://www.comeet.com/jobs/${encodeURIComponent(companySlug)}/${encodeURIComponent(companyUid)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual', // a wrong/stale slug+uid 302s to the Comeet homepage — a manual 200 check below is what actually distinguishes that from success
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumakerBot/1.0)' },
    });
    if (res.status !== 200) return null;
    const html = await res.text();
    const json = extractBalancedJson(html, 'COMPANY_DATA');
    if (!json) return null;
    const data = JSON.parse(json) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}
