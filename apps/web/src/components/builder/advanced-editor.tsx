'use client';

import { useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { ContactCard } from './sections/contact-card';
import { SummaryCard } from './sections/summary-card';
import { ExperienceSection } from './sections/experience-section';
import { EducationSection } from './sections/education-section';
import { ProjectsSection } from './sections/projects-section';
import { SkillsSection } from './sections/skills-section';
import { CertificationsSection } from './sections/certifications-section';
import { AwardsSection } from './sections/awards-section';
import { LanguagesSection } from './sections/languages-section';

/**
 * Composes every section into the advanced builder editor.
 *
 * Owns the single-edit rule (one `editingId` across all sections —
 * switching while another card is mid-edit prompts to save / discard).
 *
 * State for the actual resume content lives in the parent
 * (`builder/page.tsx`) so basic ↔ advanced mode toggle preserves
 * data. This component just patches sections of that state.
 */

export interface AdvancedEditorProps {
  resume: Resume;
  onChange: (next: Resume) => void;
  /** Optional JD context — when set, enables "Rewrite for this JD" affordances. */
  jobDescription?: string | undefined;
}

export function AdvancedEditor({ resume, onChange, jobDescription }: AdvancedEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function trySetEditingId(next: string | null) {
    if (editingId && next && editingId !== next) {
      // Same browser confirm dialog as job-app — quick and predictable.
      const ok = window.confirm('Save or discard the current edits first?');
      if (!ok) return;
    }
    setEditingId(next);
  }

  // Convenience patcher — type-safe field setter on the top-level Resume.
  function patch<K extends keyof Resume>(key: K, value: Resume[K]) {
    onChange({ ...resume, [key]: value });
  }

  return (
    <div className="space-y-6">
      <ContactCard
        contact={resume.contact}
        onChange={(c) => patch('contact', c)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <SummaryCard
        summary={resume.summary}
        onChange={(s) => patch('summary', s)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
        jobDescription={jobDescription ?? ''}
      />
      <ExperienceSection
        entries={resume.experience}
        onChange={(e) => patch('experience', e)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
        jobDescription={jobDescription ?? ''}
      />
      <EducationSection
        entries={resume.education}
        onChange={(e) => patch('education', e)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <ProjectsSection
        entries={resume.projects ?? []}
        onChange={(e) => patch('projects', e)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <SkillsSection skills={resume.skills} onChange={(s) => patch('skills', s)} />
      <CertificationsSection
        entries={resume.certifications ?? []}
        onChange={(c) => patch('certifications', c)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <AwardsSection
        entries={resume.awards ?? []}
        onChange={(a) => patch('awards', a)}
        editingId={editingId}
        onSetEditingId={trySetEditingId}
      />
      <LanguagesSection
        languages={resume.languages ?? []}
        onChange={(l) => patch('languages', l)}
      />
    </div>
  );
}
