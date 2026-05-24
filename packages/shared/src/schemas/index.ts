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

export const ExperienceSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  start_date: z.string(), // ISO date
  end_date: z.string().nullable(), // null = current
  location: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  highlights: z.array(z.string().max(500)).max(10).default([]),
});

export const EducationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200),
  field: z.string().max(200).optional(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  gpa: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
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
  languages: z
    .array(
      z.object({
        name: z.string().max(50),
        level: z.string().max(50),
      }),
    )
    .max(10)
    .optional(),
  certifications: z
    .array(
      z.object({
        name: z.string().max(200),
        issuer: z.string().max(200),
        date: z.string().optional(),
      }),
    )
    .max(10)
    .optional(),
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
