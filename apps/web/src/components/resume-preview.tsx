'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatMonthYear } from './builder/month-year-picker';
import { normalizeLanguageLevel, type Resume } from '@resumaker/shared';

interface PreviewMetadata {
  durationMs: number;
  tokensUsed: { input: number; output: number };
  detectedLocale: string;
}

/**
 * On-screen resume preview. Renders every section the canonical
 * `Resume` schema knows about (contact, summary, experience,
 * education, projects, skills, certifications, awards, languages).
 *
 * Used by the builder's right pane in both basic + advanced mode.
 * Matches the PDF templates visually but uses HTML so it stays
 * snappy under rapid edits — defers to React-PDF for the download
 * route.
 */
export function ResumePreview({
  resume,
  metadata,
}: {
  resume: Resume;
  metadata?: PreviewMetadata;
}) {
  const lang = resume.metadata?.language;
  const isHebrew = lang === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const expHeader = isHebrew ? 'ניסיון תעסוקתי' : 'Experience';
  const eduHeader = isHebrew ? 'השכלה' : 'Education';
  const projHeader = isHebrew ? 'פרויקטים' : 'Projects';
  const skillsHeader = isHebrew ? 'מיומנויות' : 'Skills';
  const certsHeader = isHebrew ? 'הסמכות' : 'Certifications';
  const awardsHeader = isHebrew ? 'פרסים' : 'Awards';
  const presentLabel = isHebrew ? 'היום' : 'Present';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{resume.contact.name}</span>
          {metadata && (
            <span className="text-muted-foreground text-xs font-normal">
              {metadata.durationMs}ms · {metadata.tokensUsed.input + metadata.tokensUsed.output}{' '}
              tokens
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent dir={dir}>
        <div className="space-y-6">
          {(resume.contact.email || resume.contact.phone || resume.contact.location) && (
            <p className="text-muted-foreground text-sm" dir="ltr">
              {[resume.contact.email, resume.contact.phone, resume.contact.location]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {resume.summary && (
            <section>
              <p className="text-foreground/90 text-sm leading-relaxed">{resume.summary}</p>
            </section>
          )}

          {resume.experience.length > 0 && (
            <SectionHeader title={expHeader}>
              <div className="space-y-4">
                {resume.experience.map((exp, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{exp.title}</p>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {formatMonthYear(exp.start_date)} –{' '}
                        {exp.is_current ? presentLabel : formatMonthYear(exp.end_date ?? '')}
                      </p>
                    </div>
                    <p className="text-foreground/80 text-sm">
                      {exp.company}
                      {exp.location && ` · ${exp.location}`}
                    </p>
                    {exp.description && (
                      <p className="text-foreground/80 mt-1 text-sm">{exp.description}</p>
                    )}
                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {exp.highlights.map((h, j) => (
                          <li key={j} className="flex">
                            <span className="text-muted-foreground mx-2 select-none">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </SectionHeader>
          )}

          {resume.education.length > 0 && (
            <SectionHeader title={eduHeader}>
              <div className="space-y-3">
                {resume.education.map((edu, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{edu.degree}</p>
                      <p className="text-muted-foreground text-xs" dir="ltr">
                        {formatMonthYear(edu.start_date)} –{' '}
                        {edu.is_current ? presentLabel : formatMonthYear(edu.end_date ?? '')}
                      </p>
                    </div>
                    <p className="text-foreground/80">
                      {edu.institution}
                      {edu.field && ` · ${edu.field}`}
                      {edu.gpa && ` · GPA: ${edu.gpa}`}
                    </p>
                  </div>
                ))}
              </div>
            </SectionHeader>
          )}

          {resume.projects && resume.projects.length > 0 && (
            <SectionHeader title={projHeader}>
              <div className="space-y-3">
                {resume.projects.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">
                        {p.name}
                        {p.is_ongoing && (
                          <span className="ms-2 rounded-full bg-green-100 px-2 py-0.5 align-middle text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
                            {isHebrew ? 'פעיל' : 'Ongoing'}
                          </span>
                        )}
                      </p>
                      {(p.start_date || p.end_date) && (
                        <p className="text-muted-foreground text-xs" dir="ltr">
                          {formatMonthYear(p.start_date ?? '')} –{' '}
                          {p.is_ongoing ? presentLabel : formatMonthYear(p.end_date ?? '')}
                        </p>
                      )}
                    </div>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 text-xs underline"
                      >
                        {p.url.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {p.technologies && p.technologies.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.technologies.map((t) => (
                          <span
                            key={t}
                            className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.description && (
                      <p className="text-foreground/80 mt-1 text-sm">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionHeader>
          )}

          {resume.skills.length > 0 && (
            <SectionHeader title={skillsHeader}>
              <div className="flex flex-wrap gap-2">
                {resume.skills.map((s, i) => (
                  <span
                    key={i}
                    className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 rounded-md px-2.5 py-1 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </SectionHeader>
          )}

          {resume.certifications && resume.certifications.length > 0 && (
            <SectionHeader title={certsHeader}>
              <ul className="space-y-1">
                {resume.certifications.map((c, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{c.name}</span>
                      {c.issuer && <span className="text-muted-foreground"> · {c.issuer}</span>}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {c.date && formatMonthYear(c.date)}
                      {c.credential_url && (
                        <a
                          href={c.credential_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 ms-2 underline"
                        >
                          {isHebrew ? 'הצג' : 'view'}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionHeader>
          )}

          {resume.awards && resume.awards.length > 0 && (
            <SectionHeader title={awardsHeader}>
              <ul className="space-y-2">
                {resume.awards.map((a, i) => (
                  <li key={i}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span>
                        <span className="font-medium">{a.title}</span>
                        {a.issuer && <span className="text-muted-foreground"> · {a.issuer}</span>}
                      </span>
                      {a.date && (
                        <span className="text-muted-foreground text-xs">
                          {formatMonthYear(a.date)}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-foreground/80 mt-1 text-sm">{a.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </SectionHeader>
          )}

          {resume.languages && resume.languages.length > 0 && (
            <section className="border-border border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {resume.languages.map((l, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    {l.name} <span className="opacity-70">({normalizeLanguageLevel(l.level)})</span>
                  </span>
                ))}
              </p>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-foreground border-border mb-2 border-b pb-1 text-sm font-semibold uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </section>
  );
}
