'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { ProfileContent } from '@resumaker/shared';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ContactCard } from '@/components/builder/sections/contact-card';
import { SummaryCard } from '@/components/builder/sections/summary-card';
import { ExperienceSection } from '@/components/builder/sections/experience-section';
import { EducationSection } from '@/components/builder/sections/education-section';
import { ProjectsSection } from '@/components/builder/sections/projects-section';
import { SkillsSection } from '@/components/builder/sections/skills-section';
import { CertificationsSection } from '@/components/builder/sections/certifications-section';
import { AwardsSection } from '@/components/builder/sections/awards-section';
import { LanguagesSection } from '@/components/builder/sections/languages-section';
import { ImportModal } from '@/components/builder/import-modal';
import { applyImportedProfile } from '@/lib/builder/apply-import';

const STEPS = [
  'contact',
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'certifications',
  'awards',
  'languages',
] as const;
type Step = (typeof STEPS)[number];

function isStepEmpty(step: Step, content: ProfileContent): boolean {
  switch (step) {
    case 'contact':
      return !content.contact.name.trim();
    case 'summary':
      return !content.summary.trim();
    case 'experience':
      return content.experience.length === 0;
    case 'education':
      return content.education.length === 0;
    case 'projects':
      return (content.projects ?? []).length === 0;
    case 'skills':
      return content.skills.length === 0;
    case 'certifications':
      return (content.certifications ?? []).length === 0;
    case 'awards':
      return (content.awards ?? []).length === 0;
    case 'languages':
      return (content.languages ?? []).length === 0;
  }
}

export function OnboardingWizard({
  accountName,
  accountEmail,
  initialContent,
}: {
  accountName: string;
  accountEmail: string;
  initialContent: Partial<ProfileContent> | null;
}) {
  const t = useTranslations('careerProfile.onboarding');
  const router = useRouter();
  const [content, setContent] = useState<ProfileContent>(() => ({
    // Saved content wins when present; account name/email are only a
    // fallback for empty fields — NOT applied after the spread, which
    // would silently clobber a real saved name with '' the moment a
    // profile row exists (even the auto-created empty default from
    // GET /api/profile), permanently defeating the account prefill.
    contact: {
      ...initialContent?.contact,
      name: initialContent?.contact?.name || accountName,
      email: initialContent?.contact?.email || accountEmail,
    },
    summary: initialContent?.summary ?? '',
    experience: initialContent?.experience ?? [],
    education: initialContent?.education ?? [],
    skills: initialContent?.skills ?? [],
    projects: initialContent?.projects,
    certifications: initialContent?.certifications,
    awards: initialContent?.awards,
    languages: initialContent?.languages,
  }));
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const step = STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  async function persist(next: ProfileContent) {
    setContent(next);
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch {
      // Non-fatal — the in-memory `content` state (which drives the UI
      // and every later step) is already updated regardless, so a
      // transient network blip here doesn't lose anything the user
      // typed; the next successful save call will include it.
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (step === 'contact' && !content.contact.name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }
    setFinishing(true);
    try {
      const res = await fetch('/api/profile/complete-onboarding', { method: 'POST' });
      if (!res.ok) {
        toast.error(t('finishFailed'));
        return;
      }
      router.push('/career-profile');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFinishing(false);
    }
  }

  function goBack() {
    // Never clears `content` — going back just moves the step index;
    // every field already typed on any step stays in state.
    if (!isFirst) setStepIndex((i) => i - 1);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-muted-foreground text-sm font-medium">
            {t('stepCounter', { current: stepIndex + 1, total: STEPS.length })}
          </p>
          {saving && <p className="text-muted-foreground text-xs">{t('saving')}</p>}
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-brand-600 ease-smooth h-full rounded-full transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {isFirst && (
        <div className="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div>
            <p className="text-foreground text-sm font-medium">{t('importPrompt')}</p>
            <p className="text-muted-foreground text-xs">{t('importHint')}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="me-1.5 h-3.5 w-3.5" />
            {t('import')}
          </Button>
        </div>
      )}

      {step === 'contact' && (
        <ContactCard
          contact={content.contact}
          onChange={(c) => void persist({ ...content, contact: c })}
        />
      )}
      {step === 'summary' && (
        <SummaryCard
          summary={content.summary}
          onChange={(s) => void persist({ ...content, summary: s })}
          editingId={editingId}
          onSetEditingId={setEditingId}
          jobDescription=""
        />
      )}
      {step === 'experience' && (
        <ExperienceSection
          entries={content.experience}
          onChange={(e) => void persist({ ...content, experience: e })}
          editingId={editingId}
          onSetEditingId={setEditingId}
          jobDescription=""
        />
      )}
      {step === 'education' && (
        <EducationSection
          entries={content.education}
          onChange={(e) => void persist({ ...content, education: e })}
          editingId={editingId}
          onSetEditingId={setEditingId}
        />
      )}
      {step === 'projects' && (
        <ProjectsSection
          entries={content.projects ?? []}
          onChange={(e) => void persist({ ...content, projects: e })}
          editingId={editingId}
          onSetEditingId={setEditingId}
        />
      )}
      {step === 'skills' && (
        <SkillsSection
          skills={content.skills}
          onChange={(s) => void persist({ ...content, skills: s })}
        />
      )}
      {step === 'certifications' && (
        <CertificationsSection
          entries={content.certifications ?? []}
          onChange={(c) => void persist({ ...content, certifications: c })}
          editingId={editingId}
          onSetEditingId={setEditingId}
        />
      )}
      {step === 'awards' && (
        <AwardsSection
          entries={content.awards ?? []}
          onChange={(a) => void persist({ ...content, awards: a })}
          editingId={editingId}
          onSetEditingId={setEditingId}
        />
      )}
      {step === 'languages' && (
        <LanguagesSection
          languages={content.languages ?? []}
          onChange={(l) => void persist({ ...content, languages: l })}
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={goBack} disabled={isFirst}>
          <ArrowLeft className="me-1.5 h-4 w-4 rtl:hidden" />
          <ArrowRight className="me-1.5 hidden h-4 w-4 rtl:inline" />
          {t('back')}
        </Button>
        <Button type="button" onClick={() => void goNext()} disabled={finishing}>
          {isLast ? (
            <>
              <Check className="me-1.5 h-4 w-4" />
              {finishing ? t('finishing') : t('finish')}
            </>
          ) : isStepEmpty(step, content) && step !== 'contact' ? (
            t('skip')
          ) : (
            t('continue')
          )}
        </Button>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={(profile, opts) => void persist(applyImportedProfile(content, profile, opts))}
      />
    </div>
  );
}
