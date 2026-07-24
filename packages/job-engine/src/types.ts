export type Source =
  | 'greenhouse'
  | 'lever'
  | 'workable'
  | 'ashby'
  | 'comeet'
  | 'taasuka'
  | 'serper'
  | 'jooble'
  | 'adzuna'
  | 'manual'
  | 'hr';

// `field?: T | undefined` (vs `field?: T`) is required when host monorepo
// runs `exactOptionalPropertyTypes: true` — assigning `undefined` to a
// `field?: T` is rejected, but to `field?: T | undefined` it's fine. The
// source clients all build objects with conditional values, so we permit
// the explicit undefined here.
export interface NormalizedJob {
  externalId: string;
  source: Source;
  company: string;
  companySlug?: string | undefined;
  title: string;
  location?: string | undefined;
  description: string;
  url: string;
  urlNormalized: string;
  remote: boolean;
  seniority?: string | undefined;
  postedAt?: Date | undefined;
  rawData?: unknown;
}

/**
 * Every source fetcher returns this instead of a bare array. A board with
 * zero open roles (`ok: true, jobs: []`) and a board that failed to fetch
 * (`ok: false`) used to both collapse to `[]` — indistinguishable to the
 * caller. That matters once closure detection exists: absence from a
 * *successful* fetch is a real "this job is gone" signal, but absence
 * because the fetch itself errored is not, and conflating them would mark
 * an entire company's board closed on a single transient network blip.
 */
export type FetchResult = { ok: true; jobs: NormalizedJob[] } | { ok: false; error: string };

export interface FitScore {
  score: number;
  rationale: string;
  strengths: string[];
  gaps: string[];
}

export type UserProfile = Record<string, unknown>;
