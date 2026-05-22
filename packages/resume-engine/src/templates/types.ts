import type { Resume } from '@resumaker/shared';

export interface ResumePdfProps {
  resume: Resume;
  /** Optional accent color override. Default brand blue. */
  accentColor?: string;
}
