/**
 * One-shot handoff of a just-generated resume's job description into
 * the cover-letter form, so "also make a cover letter for this" doesn't
 * mean re-pasting the same JD. sessionStorage (not a DB column) is
 * deliberate: this app doesn't persist raw job-description text
 * anywhere today (generations only keep a hash of it) and this
 * shouldn't change that — the value only needs to survive one
 * client-side navigation, not outlive the tab.
 */
export const COVER_LETTER_PREFILL_KEY = 'resumaker:cover-letter-prefill';

export interface CoverLetterPrefill {
  jobDescription: string;
  companyName?: string;
}

export function readAndClearCoverLetterPrefill(): CoverLetterPrefill | null {
  try {
    const raw = sessionStorage.getItem(COVER_LETTER_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(COVER_LETTER_PREFILL_KEY);
    const parsed = JSON.parse(raw) as Partial<CoverLetterPrefill>;
    if (!parsed.jobDescription) return null;
    return {
      jobDescription: parsed.jobDescription,
      ...(parsed.companyName && { companyName: parsed.companyName }),
    };
  } catch {
    return null;
  }
}
