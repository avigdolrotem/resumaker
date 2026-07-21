/**
 * Apply a parsed import (from /api/profile/import) into the current
 * resume content. Strategy per the rework spec (§5.4):
 *
 *   - Contact fields: per-field overwrite ONLY when the parsed value
 *     is non-empty. Never wipe a manually-entered field with a blank.
 *   - Summary: overwrite when non-empty.
 *   - Experience / Education / Projects / Certifications / Awards:
 *     REPLACE the whole list ONLY when the parsed list is non-empty.
 *     If the parser came up empty (the doc was bad), keep existing
 *     entries — never silently delete user data.
 *   - Skills: MERGE (dedup by lowercased name).
 *   - Languages: MERGE (dedup by lowercased name).
 *
 * `opts` is a per-section opt-in map — the modal's checklist UI
 * lets users untick sections they don't want to import.
 */

import type { ProfileContent } from '@resumaker/shared';
import { normalizeLanguageLevel } from '@resumaker/shared';

/**
 * The /api/profile/import endpoint returns a flat ParsedProfile shape
 * (name/email at top level, not nested under contact). This type
 * captures the fields we actually consume; extras are ignored.
 */
export interface ParsedImport {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary?: string;
  skills?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    start_date?: string;
    end_date?: string | null;
    is_current?: boolean;
    location?: string;
    description?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    field?: string;
    start_date?: string;
    end_date?: string | null;
    is_current?: boolean;
    gpa?: string;
    description?: string;
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    technologies?: string[];
    url?: string;
    start_date?: string;
    end_date?: string | null;
    is_ongoing?: boolean;
  }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    date?: string;
    credential_url?: string;
  }>;
  awards?: Array<{
    title?: string;
    issuer?: string;
    date?: string;
    description?: string;
  }>;
  languages?: Array<{ name?: string; level?: string }>;
}

export interface ImportOpts {
  contact: boolean;
  summary: boolean;
  experience: boolean;
  education: boolean;
  projects: boolean;
  skills: boolean;
  certifications: boolean;
  awards: boolean;
  languages: boolean;
}

export const DEFAULT_OPTS: ImportOpts = {
  contact: true,
  summary: true,
  experience: true,
  education: true,
  projects: true,
  skills: true,
  certifications: true,
  awards: true,
  languages: true,
};

export function applyImportedProfile<T extends ProfileContent>(
  current: T,
  imported: ParsedImport,
  opts: ImportOpts = DEFAULT_OPTS,
): T {
  const next: T = { ...current };

  if (opts.contact) {
    next.contact = {
      ...current.contact,
      ...(imported.name && { name: imported.name }),
      ...(imported.email && { email: imported.email }),
      ...(imported.phone && { phone: imported.phone }),
      ...(imported.location && { location: imported.location }),
      ...(imported.linkedin && { linkedin: imported.linkedin }),
      ...(imported.github && { github: imported.github }),
      ...(imported.website && { website: imported.website }),
    };
  }

  if (opts.summary && imported.summary?.trim()) {
    next.summary = imported.summary;
  }

  if (opts.experience && imported.experience && imported.experience.length > 0) {
    next.experience = imported.experience.map((e) => ({
      company: e.company ?? '',
      title: e.title ?? '',
      start_date: e.start_date ?? '',
      end_date: e.end_date ?? null,
      is_current: e.is_current ?? false,
      ...(e.location && { location: e.location }),
      ...(e.description && { description: e.description }),
      highlights: e.highlights ?? [],
    }));
  }

  if (opts.education && imported.education && imported.education.length > 0) {
    next.education = imported.education.map((e) => ({
      institution: e.institution ?? '',
      degree: e.degree ?? '',
      start_date: e.start_date ?? '',
      end_date: e.end_date ?? null,
      is_current: e.is_current ?? false,
      ...(e.field && { field: e.field }),
      ...(e.gpa && { gpa: e.gpa }),
      ...(e.description && { description: e.description }),
    }));
  }

  if (opts.projects && imported.projects && imported.projects.length > 0) {
    next.projects = imported.projects.map((p) => ({
      name: p.name ?? '',
      description: p.description ?? '',
      is_ongoing: p.is_ongoing ?? false,
      ...(p.technologies && { technologies: p.technologies }),
      ...(p.url && { url: p.url }),
      ...(p.start_date && { start_date: p.start_date }),
      ...(p.end_date !== undefined && { end_date: p.end_date }),
    }));
  }

  if (opts.skills && imported.skills && imported.skills.length > 0) {
    const existingLower = new Set(current.skills.map((s) => s.toLowerCase()));
    const adds = imported.skills.filter((s) => s && !existingLower.has(s.toLowerCase()));
    next.skills = [...current.skills, ...adds];
  }

  if (opts.certifications && imported.certifications && imported.certifications.length > 0) {
    next.certifications = imported.certifications.map((c) => ({
      name: c.name ?? '',
      ...(c.issuer && { issuer: c.issuer }),
      ...(c.date && { date: c.date }),
      ...(c.credential_url && { credential_url: c.credential_url }),
    }));
  }

  if (opts.awards && imported.awards && imported.awards.length > 0) {
    next.awards = imported.awards.map((a) => ({
      title: a.title ?? '',
      ...(a.issuer && { issuer: a.issuer }),
      ...(a.date && { date: a.date }),
      ...(a.description && { description: a.description }),
    }));
  }

  if (opts.languages && imported.languages && imported.languages.length > 0) {
    const existing = new Set((current.languages ?? []).map((l) => l.name.toLowerCase()));
    const adds = imported.languages
      .filter((l) => l.name && !existing.has(l.name.toLowerCase()))
      .map((l) => ({ name: l.name!, level: normalizeLanguageLevel(l.level) }));
    next.languages = [...(current.languages ?? []), ...adds];
  }

  return next;
}
