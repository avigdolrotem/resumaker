/** Strip HTML tags and collapse whitespace. */
export function stripHtml(html: string): string {
  const unescaped = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  const noTags = unescaped.replace(/<[^>]+>/g, ' ');
  return noTags.replace(/\s+/g, ' ').trim();
}

const SENIORITY_PATTERNS: Array<[string, RegExp]> = [
  ['intern', /\bintern(ship)?\b/i],
  ['junior', /\b(junior|jr\.?|entry.?level|associate)\b/i],
  ['mid', /\b(mid.?level|mid|intermediate)\b/i],
  ['senior', /\b(senior|sr\.?|lead)\b/i],
  ['staff', /\b(staff|principal|architect)\b/i],
  ['manager', /\b(manager|head of|director|vp|vice president|cto|cpo)\b/i],
];

/** Infer a seniority label from a job title, or return undefined. */
export function inferSeniority(title: string): string | undefined {
  for (const [level, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  return undefined;
}

/** Parse ISO date strings and Lever-style ms timestamps into Date objects. */
export function parseIsoDate(value: string | number | null | undefined): Date | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') {
    try {
      return new Date(value);
    } catch {
      return undefined;
    }
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}
