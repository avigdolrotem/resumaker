import * as cheerio from 'cheerio';
import type { NormalizedJob, FetchResult } from '../types';
import { inferSeniority } from '../html-utils';

const BASE_URL = 'https://www.taasuka.gov.il/applicants/jobs/';

/**
 * Occupation categories (ProfessionCategoryCode) from the site's own
 * filter form — server-side GET params (searchJobsForm uses method="get"),
 * verified live, 2026-07-24. Crawling per-category means every job is
 * occupation-tagged at ingest time for free, rather than needing to
 * infer a category from free text after the fact. Full label list kept
 * here (not just the office/tech subset) since the product decision was
 * to ingest and tag everything — only the *default feed view* filters to
 * a subset, at the query layer, not at ingest.
 */
export const TAASUKA_PROFESSION_CATEGORIES: Record<string, string> = {
  '1': 'אבטחה, שמירה,ביטחון וחקירות',
  '2': 'אופנה וטקסטיל',
  '3': 'אחזקה וניקיון',
  '4': 'אינטרנט',
  '5': 'אלקטרוניקה וחשמל',
  '6': 'ביוטכנולוגיה',
  '7': 'ביטוח',
  '8': 'בינוי,תשתיות ונדל"ן',
  '9': 'גרפיקה,עיצוב ואומנות',
  '10': 'הוראה חינוך והדרכה',
  '11': 'הנדסה',
  '12': 'חוק ומשפט',
  '13': 'חשבונאות וכספים',
  '14': 'טבע וחקלאות',
  '15': 'יופי, טיפוח וספא',
  '16': 'ייצור,מכונות ותעשייה',
  '17': 'כללי וללא ניסיון',
  '18': 'כתיבה, עריכה ותרגום',
  '19': 'לוגיסטיקה,רכש ושילוח',
  '20': 'מדע/מדעים מדוייקים',
  '21': 'מדעי החברה',
  '22': 'מזכירות ואדמיניסטרציה',
  '23': 'מחשוב רשתות ותוכנה',
  '24': 'מכירות',
  '25': 'מסעדנות,מזון ואירועים',
  '26': 'משאבי אנוש',
  '27': 'ניהול בכיר',
  '126': 'ניהול זוטר',
  '108': 'ספורט',
  '29': 'קמעונאות',
  '30': 'רפואה ובריאות',
  '31': 'שיווק ופרסום',
  '32': 'שירות לקוחות',
  '28': 'שירותי דת',
  '33': 'תוכן,מדיה ובידור',
  '34': 'תחבורה ורכב',
  '35': 'תיירות ומלונאות',
  '36': 'תעופה אווירונאוטיקה וימאות',
  '37': 'תעשייה וניהול',
};

// Conservative on purpose — under-stripping a phone/email is worse to
// catch in review than over-stripping something that merely looks like
// one, but false positives here (redacting a real requirement like "10
// years experience") are exactly the failure mode to avoid, so these
// only match clearly phone/email-shaped substrings, not loose numbers.
const IL_PHONE_RE = /(?:\+972[-\s]?|0)([23489]|5[0-9]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function stripPii(text: string): string {
  return text.replace(EMAIL_RE, '[redacted]').replace(IL_PHONE_RE, '[redacted]');
}

/** "24.07.2026" -> Date. Returns undefined for anything that doesn't match. */
function parseTaasukaDate(value: string): Date | undefined {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!m || !m[1] || !m[2] || !m[3]) return undefined;
  const [, day, month, year] = m;
  const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return isNaN(d.getTime()) ? undefined : d;
}

// FetchResult is a discriminated union ({ok:true,jobs}|{ok:false,error}) —
// `interface extends` only accepts object/intersection types, not unions,
// so this adds the extra field via `&` instead, which distributes over
// the union the same way (totalResults tacked onto either branch).
export type TaasukaPageResult = FetchResult & {
  /** Parsed from "נמצאו N תוצאות" — lets the caller stop paginating on a
   *  real signal instead of a hardcoded page count that goes stale the
   *  moment the site's inventory changes. undefined if not found (should
   *  only happen on a genuinely malformed/changed page — treat as ok:true
   *  with unknown total rather than failing the whole fetch over it). */
  totalResults?: number | undefined;
};

/**
 * Fetch and parse one page of Taasuka's job listings. Unlike every other
 * source in this package, there is no API — this is HTML scraping of
 * Israel's national employment service (robots.txt is fully permissive,
 * verified 2026-07-24: `User-agent: * / Disallow:` with no restrictions).
 *
 * Deliberately does NOT hit the individual job "detail" pages
 * (/applicants/jobdetails/?jobid=...) — verified live that those are
 * client-rendered (the page's own HTML never contains the job's actual
 * title/company/description text, only a server-set <title> tag) and
 * would need a headless browser per job. Unnecessary: the *listing* page
 * is fully server-rendered and each card already contains everything —
 * title, location, site job number, explicit status, update date, and
 * both the job description and requirements paragraphs in full.
 *
 * Listings here are anonymized (no employer name shown, ever — verified
 * across every listing checked) and the site gives no company identity
 * at all, so `company` is a fixed placeholder; this also means Taasuka
 * rows can never participate in company-based cross-source dedup, which
 * is correct — an anonymized government listing and a named ATS listing
 * can't be confidently merged anyway.
 */
export async function fetchTaasukaPage(
  page: number,
  professionCategoryCode?: string,
): Promise<TaasukaPageResult> {
  const params = new URLSearchParams({ page: String(page) });
  if (professionCategoryCode) params.set('ProfessionCategoryCode', professionCategoryCode);
  const url = `${BASE_URL}?${params.toString()}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResumakerBot/1.0; +https://resumaker.co.il)',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  let jobs: NormalizedJob[];
  let totalResults: number | undefined;
  try {
    const $ = cheerio.load(html);
    jobs = [];

    $('.jobItem').each((_, el) => {
      const $el = $(el);
      const jobId = $el.attr('jobid');
      if (!jobId) return;
      const title = ($el.attr('jobtitle') ?? '').trim();

      const details: Record<string, string> = {};
      $el.find('.jobDetails > div').each((_i, row) => {
        const label = $(row).find('strong').text().trim();
        const value = $(row).find('span').text().trim();
        if (label) details[label] = value;
      });

      // Explicit status, when present, is a stronger signal than every
      // other source gets — a listing marked inactive/filled is simply
      // excluded here rather than returned, which lets it flow through
      // the exact same "wasn't seen this run" closure path the cron
      // already runs for every source (see sweepClosures in the cron
      // route) instead of needing a second, Taasuka-specific mechanism.
      const status = details['מצב משרה'] ?? '';
      if (status && status !== 'פעילה') return;

      const siteJobNumber = details["מס' משרה באתר"] || jobId;
      const location = details['מקום עבודה'] || undefined;
      const updateDate = parseTaasukaDate(details['תאריך עדכון'] ?? '');

      // Both "תיאור התפקיד" (description) and "דרישות" (requirements) live
      // as separate <strong>/<p> pairs inside .text. Mapping each <p>
      // individually and joining with a blank line (rather than calling
      // .text() on the whole multi-element selection, which concatenates
      // every paragraph's text with no separator at all) keeps the two
      // sections readable instead of running the last sentence of the
      // description straight into the first word of the requirements.
      const paragraphs = $el
        .find('.text p')
        .map((_i, p) => $(p).text().trim())
        .get()
        .filter(Boolean);
      const bodyText = stripPii(paragraphs.join('\n\n'));

      const detailUrl = `https://www.taasuka.gov.il/applicants/jobdetails/?jobid=${jobId}`;
      // normalizeUrl() strips query strings, which is right for every
      // other source (their job identity lives in the path) but wrong
      // here: every Taasuka listing shares the exact same path
      // (/applicants/jobdetails/) and differs *only* by ?jobid=... —
      // running it through the shared normalizer would collapse every
      // single Taasuka job onto one identical urlNormalized value,
      // silently violating jobs_url_norm_unique the moment a second job
      // gets inserted (verified live: two different jobids do collapse
      // to the same normalized URL). Build a Taasuka-specific normalized
      // form that keeps the jobid instead.
      const urlNormalized = `https://www.taasuka.gov.il/applicants/jobdetails?jobid=${jobId}`;

      jobs.push({
        externalId: siteJobNumber,
        source: 'taasuka',
        // Every listing checked was anonymized at the employer level —
        // no company name field exists anywhere on this site's job
        // cards. Hebrew placeholder ("not specified"), not English, to
        // match the surrounding UI language for Taasuka-sourced cards.
        company: 'לא צוין',
        title,
        location,
        description: bodyText,
        url: detailUrl,
        urlNormalized,
        remote: false,
        seniority: inferSeniority(title),
        postedAt: updateDate,
        rawData: professionCategoryCode ? { professionCategoryCode } : undefined,
      });
    });

    const bodyText = $('body').text();
    const totalMatch = /נמצאו\s+([\d,]+)\s+תוצאות/.exec(bodyText);
    totalResults = totalMatch?.[1] ? Number(totalMatch[1].replace(/,/g, '')) : undefined;
  } catch (err) {
    return { ok: false, error: `parse failed: ${(err as Error).message}` };
  }

  return { ok: true, jobs, totalResults };
}
