'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ParsedImport, type ImportOpts, DEFAULT_OPTS } from '@/lib/builder/apply-import';

/**
 * Multi-step import modal: Upload → Parsing → Preview → Apply.
 *
 * Calls the existing /api/profile/import endpoint. The endpoint returns
 * a flat ParsedProfile shape (name/email at top level), so applying
 * its output goes through `applyImportedProfile` in the parent which
 * handles the per-section merge/replace strategy.
 *
 * The Preview step lets users opt out of any section before applying —
 * useful when the parser misreads something or you only want certs/skills.
 */

type Step = 'upload' | 'parsing' | 'preview' | 'error';

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (profile: ParsedImport, opts: ImportOpts) => void;
}

export function ImportModal({ open, onClose, onApply }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState<ImportOpts>({ ...DEFAULT_OPTS });
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleFile(file: File) {
    setStep('parsing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      setParsed(data.profile);
      setStep('preview');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  function reset() {
    setStep('upload');
    setParsed(null);
    setError(null);
    setOpts({ ...DEFAULT_OPTS });
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import resume"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="border-border bg-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground absolute end-4 top-4"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-xl font-bold">Import resume</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          PDF or TXT, up to 10MB. We&apos;ll show a preview before applying.
        </p>

        {step === 'upload' && (
          <div
            role="button"
            tabIndex={0}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            className="border-border hover:border-brand-300 bg-muted/30 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors"
          >
            <Upload className="text-muted-foreground mx-auto h-8 w-8" />
            <p className="text-foreground mt-2 text-sm font-medium">Drag a PDF or TXT here</p>
            <p className="text-muted-foreground text-xs">or click to choose</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="text-brand-500 h-8 w-8 animate-spin" />
            <p className="text-muted-foreground text-sm">Claude is reading your resume…</p>
            <p className="text-muted-foreground/70 text-xs">Usually 5–15 seconds</p>
          </div>
        )}

        {step === 'error' && (
          <div className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border p-3 text-sm">
            <p className="font-medium">Couldn&apos;t parse the file</p>
            <p className="text-xs">{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={reset}>
              Try again
            </Button>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="space-y-4">
            <div className="border-border bg-muted/30 rounded-md border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-3.5 w-3.5" />
                What we found:
              </p>
              <ul className="space-y-1 text-sm">
                {(parsed.name || parsed.email || parsed.phone) && (
                  <PreviewRow
                    ok={opts.contact}
                    onToggle={(v) => setOpts({ ...opts, contact: v })}
                    label="Contact"
                    detail={
                      [parsed.name, parsed.email, parsed.phone].filter(Boolean).join(' · ') || '—'
                    }
                  />
                )}
                {parsed.summary && (
                  <PreviewRow
                    ok={opts.summary}
                    onToggle={(v) => setOpts({ ...opts, summary: v })}
                    label="Summary"
                    detail={parsed.summary.slice(0, 80) + (parsed.summary.length > 80 ? '…' : '')}
                  />
                )}
                {parsed.experience && parsed.experience.length > 0 && (
                  <PreviewRow
                    ok={opts.experience}
                    onToggle={(v) => setOpts({ ...opts, experience: v })}
                    label="Experience"
                    detail={`${parsed.experience.length} position${parsed.experience.length === 1 ? '' : 's'} (${parsed.experience
                      .map((e) => e.company)
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(', ')})`}
                  />
                )}
                {parsed.education && parsed.education.length > 0 && (
                  <PreviewRow
                    ok={opts.education}
                    onToggle={(v) => setOpts({ ...opts, education: v })}
                    label="Education"
                    detail={`${parsed.education.length} (${parsed.education
                      .map((e) => e.institution)
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(', ')})`}
                  />
                )}
                {parsed.projects && parsed.projects.length > 0 && (
                  <PreviewRow
                    ok={opts.projects}
                    onToggle={(v) => setOpts({ ...opts, projects: v })}
                    label="Projects"
                    detail={`${parsed.projects.length}`}
                  />
                )}
                {parsed.skills && parsed.skills.length > 0 && (
                  <PreviewRow
                    ok={opts.skills}
                    onToggle={(v) => setOpts({ ...opts, skills: v })}
                    label="Skills"
                    detail={`${parsed.skills.length} skills`}
                  />
                )}
                {parsed.certifications && parsed.certifications.length > 0 && (
                  <PreviewRow
                    ok={opts.certifications}
                    onToggle={(v) => setOpts({ ...opts, certifications: v })}
                    label="Certifications"
                    detail={`${parsed.certifications.length}`}
                  />
                )}
                {parsed.awards && parsed.awards.length > 0 && (
                  <PreviewRow
                    ok={opts.awards}
                    onToggle={(v) => setOpts({ ...opts, awards: v })}
                    label="Awards"
                    detail={`${parsed.awards.length}`}
                  />
                )}
                {parsed.languages && parsed.languages.length > 0 && (
                  <PreviewRow
                    ok={opts.languages}
                    onToggle={(v) => setOpts({ ...opts, languages: v })}
                    label="Languages"
                    detail={`${parsed.languages.length}`}
                  />
                )}
              </ul>
            </div>
            <p className="text-muted-foreground text-xs">
              Replace strategy: experience / education / projects / certifications / awards REPLACE
              existing entries. Skills + languages MERGE (dedup by name). Contact fields overwrite
              only when non-empty.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  onApply(parsed, opts);
                  close();
                }}
              >
                <Check className="me-1 h-3.5 w-3.5" />
                Apply to resume
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Try another file
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRow({
  ok,
  onToggle,
  label,
  detail,
}: {
  ok: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={ok}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 rounded"
        aria-label={`Include ${label} in import`}
      />
      <span>
        <span className="font-medium">{label}:</span>{' '}
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
