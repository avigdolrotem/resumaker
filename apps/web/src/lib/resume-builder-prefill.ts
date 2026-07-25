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
  /** The original posting's URL, when known — carried through so the
   * generation result screen can offer a direct "view original
   * posting" link (the whole point of generating a tailored resume for
   * a specific job is to then go apply with it). Absent for
   * manually-pasted jobs with no real URL. */
  jobUrl?: string;
}

export function readAndClearResumeBuilderPrefill(): ResumeBuilderPrefill | null {
  try {
    const raw = sessionStorage.getItem(RESUME_BUILDER_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESUME_BUILDER_PREFILL_KEY);
    const parsed = JSON.parse(raw) as Partial<ResumeBuilderPrefill>;
    if (!parsed.jobDescription) return null;
    return {
      jobDescription: parsed.jobDescription,
      ...(parsed.jobUrl && { jobUrl: parsed.jobUrl }),
    };
  } catch {
    return null;
  }
}
