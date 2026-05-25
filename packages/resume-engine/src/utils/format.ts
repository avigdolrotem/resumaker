/**
 * Pretty-print a YYYY-MM string as "Mar 2022". Empty / null / undefined
 * return empty string. Non-YYYY-MM strings pass through unchanged so
 * legacy free-text dates ("Summer 2019") still render readably.
 */
export function formatMonthYear(d: string | null | undefined): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(d);
  if (!m) return d;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || !month) return d;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

/** Per-locale "Present" word for ongoing roles / educations / projects. */
export function presentLabel(lang: string): string {
  switch (lang) {
    case 'he':
      return 'היום';
    case 'ar':
      return 'الآن';
    case 'ru':
      return 'настоящее время';
    default:
      return 'Present';
  }
}

export function localizedSectionTitle(
  lang: string,
  key: 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'certifications' | 'awards',
): string {
  const map: Record<string, Record<string, string>> = {
    summary: { he: 'תקציר', ar: 'الملخص', ru: 'Резюме', en: 'Summary' },
    experience: { he: 'ניסיון תעסוקתי', ar: 'الخبرة المهنية', ru: 'Опыт работы', en: 'Experience' },
    education: { he: 'השכלה', ar: 'التعليم', ru: 'Образование', en: 'Education' },
    projects: { he: 'פרויקטים', ar: 'المشاريع', ru: 'Проекты', en: 'Projects' },
    skills: { he: 'מיומנויות', ar: 'المهارات', ru: 'Навыки', en: 'Skills' },
    certifications: { he: 'הסמכות', ar: 'الشهادات', ru: 'Сертификаты', en: 'Certifications' },
    awards: { he: 'פרסים', ar: 'الجوائز', ru: 'Награды', en: 'Awards' },
  };
  return map[key]?.[lang] ?? map[key]?.en ?? key;
}
