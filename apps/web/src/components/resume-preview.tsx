'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ResumeData {
  metadata: { language: 'he' | 'en'; generated_at: string; template: string };
  contact: { name: string; email?: string };
  summary: string;
  experience: Array<{
    company: string;
    title: string;
    start_date: string;
    end_date: string | null;
    highlights?: string[];
  }>;
  education: Array<{ institution: string; degree: string }>;
  skills: string[];
}

interface PreviewMetadata {
  durationMs: number;
  tokensUsed: { input: number; output: number };
  detectedLocale: 'he' | 'en';
}

/**
 * On-screen resume preview. Matches the PDF template visually.
 * Defers to React-PDF for download (separate route).
 */
export function ResumePreview({
  resume,
  metadata,
}: {
  resume: ResumeData;
  metadata: PreviewMetadata;
}) {
  const isHebrew = metadata.detectedLocale === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{resume.contact.name}</span>
          <span className="text-xs font-normal text-neutral-500">
            {metadata.durationMs}ms · {metadata.tokensUsed.input + metadata.tokensUsed.output}{' '}
            tokens
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent dir={dir}>
        <div className="space-y-6">
          {resume.contact.email && (
            <p className="text-sm text-neutral-600" dir="ltr">
              {resume.contact.email}
            </p>
          )}

          <section>
            <p className="text-sm leading-relaxed">{resume.summary}</p>
          </section>

          {resume.experience.length > 0 && (
            <section>
              <h3 className="mb-2 border-b border-neutral-200 pb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                {isHebrew ? 'ניסיון תעסוקתי' : 'Experience'}
              </h3>
              <div className="space-y-4">
                {resume.experience.map((exp, i) => (
                  <div key={i}>
                    <div className="flex items-baseline justify-between">
                      <p className="font-semibold">{exp.title}</p>
                      <p className="text-xs text-neutral-500" dir="ltr">
                        {exp.start_date} – {exp.end_date ?? (isHebrew ? 'היום' : 'present')}
                      </p>
                    </div>
                    <p className="text-sm text-neutral-700">{exp.company}</p>
                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {exp.highlights.map((h, j) => (
                          <li key={j} className="flex">
                            <span className="mx-2 select-none text-neutral-400">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {resume.skills.length > 0 && (
            <section>
              <h3 className="mb-2 border-b border-neutral-200 pb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                {isHebrew ? 'מיומנויות' : 'Skills'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {resume.skills.map((s, i) => (
                  <span
                    key={i}
                    className="bg-brand-50 text-brand-700 rounded-md px-2.5 py-1 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {resume.education.length > 0 && (
            <section>
              <h3 className="mb-2 border-b border-neutral-200 pb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                {isHebrew ? 'השכלה' : 'Education'}
              </h3>
              {resume.education.map((edu, i) => (
                <div key={i} className="text-sm">
                  <p className="font-semibold">{edu.degree}</p>
                  <p className="text-neutral-600">{edu.institution}</p>
                </div>
              ))}
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
