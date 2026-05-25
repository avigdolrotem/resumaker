/**
 * Shared Zod schemas used across services.
 * Resume structure, ATS scoring, job description, etc.
 */

import { z } from 'zod';

// Locales the resume PDF templates can render. Hebrew + English are the
// primary languages of the app; Arabic + Russian are supported as second
// tier (Israeli market includes large Arab and Russian-speaking
// populations). PDF templates handle font selection per locale.
export const LocaleSchema = z.enum(['he', 'en', 'ar', 'ru']);
export type Locale = z.infer<typeof LocaleSchema>;

export const IndustrySchema = z.enum(['tech', 'healthcare', 'finance', 'general']);
export type Industry = z.infer<typeof IndustrySchema>;

export const ContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  website: z.string().url().optional(),
});

/**
 * Dates throughout the resume are stored as strings. Two formats are
 * accepted:
 *   - `YYYY-MM`   — preferred. Emitted by the new MM/YYYY date picker
 *                   in the builder. Sortable, displayable.
 *   - free text   — for older resumes or unusual cases ("Summer 2019",
 *                   "Spring 2022"). The PDF templates render as-is.
 * `null` end_date = currently held / ongoing.
 */
export const ExperienceSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  start_date: z.string(),
  end_date: z.string().nullable(),
  location: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  highlights: z.array(z.string().max(500)).max(10).default([]),
  /**
   * "Currently working here." When true, end_date should be null and the
   * UI/PDF renders "Present" in place of an end date.
   */
  is_current: z.boolean().default(false),
});

export const EducationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200),
  field: z.string().max(200).optional(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  gpa: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  /** "Currently studying." Same semantics as ExperienceSchema.is_current. */
  is_current: z.boolean().default(false),
});

/**
 * Project entry — a portfolio item, side project, or significant work
 * deliverable distinct from a job. Useful for new grads + engineers
 * with open-source contributions + freelancers showcasing client work.
 */
export const ProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  technologies: z.array(z.string().max(50)).max(20).optional(),
  url: z.string().url().max(500).optional(),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  /** "Ongoing / active." When true, end_date renders as "Present". */
  is_ongoing: z.boolean().default(false),
});

/**
 * Award / recognition / publication. Single line per entry with optional
 * issuer and date. Use for: company awards, conference talks, published
 * papers, hackathon wins, scholarships, etc.
 */
export const AwardSchema = z.object({
  title: z.string().min(1).max(200),
  issuer: z.string().max(200).optional(),
  date: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const ResumeSchema = z.object({
  metadata: z.object({
    language: LocaleSchema,
    generated_at: z.string().datetime(),
    industry: IndustrySchema.optional(),
    template: z.string().max(50),
  }),
  contact: ContactSchema,
  summary: z.string().max(2000),
  experience: z.array(ExperienceSchema).max(20),
  education: z.array(EducationSchema).max(10),
  skills: z.array(z.string().max(100)).max(50),
  /**
   * Language proficiency levels are a strict enum to keep PDF rendering
   * predictable. Legacy resumes that stored free-form levels ("B2",
   * "Advanced", etc.) are normalized via `normalizeLanguageLevel` on the
   * UI boundary before reaching this schema.
   */
  languages: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        level: z.enum(['native', 'fluent', 'professional', 'conversational', 'basic']),
      }),
    )
    .max(10)
    .optional(),
  certifications: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        issuer: z.string().max(200).optional(),
        date: z.string().optional(),
        /** Optional link to the credential / certificate page. */
        credential_url: z.string().url().max(500).optional(),
      }),
    )
    .max(10)
    .optional(),
  /** Portfolio items / open-source / freelance work distinct from jobs. */
  projects: z.array(ProjectSchema).max(15).optional(),
  /** Awards, talks, publications, scholarships, hackathon wins. */
  awards: z.array(AwardSchema).max(15).optional(),
});

export type Resume = z.infer<typeof ResumeSchema>;

export const ATSScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  matched_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  suggestions: z.array(
    z.object({
      type: z.enum(['keyword', 'format', 'content', 'structure']),
      severity: z.enum(['low', 'medium', 'high']),
      message: z.string(),
    }),
  ),
});

export type ATSScore = z.infer<typeof ATSScoreSchema>;
