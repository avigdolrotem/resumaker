export type Source =
  | 'greenhouse'
  | 'lever'
  | 'workable'
  | 'ashby'
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

export interface FitScore {
  score: number;
  rationale: string;
  strengths: string[];
  gaps: string[];
}

export type UserProfile = Record<string, unknown>;
