/**
 * One-shot handoff of a job description into the resume builder, so
 * "generate a resume for this job" from a dashboard recommendation card
 * doesn't mean copy-pasting the JD by hand. Same sessionStorage,
 * read-and-clear pattern as {@link COVER_LETTER_PREFILL_KEY} — see that
 * file's comment for why sessionStorage over a DB column. Kept as its
 * own key rather than reusing the cover-letter one: the two handoffs
 * (dashboard→builder, builder→cover-letters) can otherwise land in the
 * same tab back-to-back, and a shared key would let one clobber the
 * other.
 */
export const RESUME_BUILDER_PREFILL_KEY = 'resumaker:resume-builder-prefill';

export interface ResumeBuilderPrefill {
  jobDescription: string;
}

export function readAndClearResumeBuilderPrefill(): ResumeBuilderPrefill | null {
  try {
    const raw = sessionStorage.getItem(RESUME_BUILDER_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESUME_BUILDER_PREFILL_KEY);
    const parsed = JSON.parse(raw) as Partial<ResumeBuilderPrefill>;
    if (!parsed.jobDescription) return null;
    return { jobDescription: parsed.jobDescription };
  } catch {
    return null;
  }
}
