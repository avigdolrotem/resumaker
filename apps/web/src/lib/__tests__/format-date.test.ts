import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '../format-date';

/**
 * Guards against reintroducing bare `toLocaleDateString()`, which
 * resolves against the runtime's locale — the container's, in a Server
 * Component — rather than the locale the user is browsing in.
 */
describe('formatDate', () => {
  const d = new Date('2026-07-31T12:00:00Z');

  it('formats day-first for Hebrew and month-first for English', () => {
    const he = formatDate(d, 'he');
    const en = formatDate(d, 'en');
    expect(he).not.toBe(en);
    // he-IL puts the day first; en-US puts the month first.
    expect(he.startsWith('31')).toBe(true);
    expect(en.startsWith('7')).toBe(true);
  });

  it('treats an unknown/absent locale as English rather than throwing', () => {
    expect(formatDate(d, undefined)).toBe(formatDate(d, 'en'));
    expect(formatDate(d, 'fr')).toBe(formatDate(d, 'en'));
  });

  it('accepts Date, ISO string and epoch millis alike', () => {
    expect(formatDate(d, 'en')).toBe(formatDate(d.toISOString(), 'en'));
    expect(formatDate(d, 'en')).toBe(formatDate(d.getTime(), 'en'));
  });

  it('returns a placeholder for an invalid date instead of "Invalid Date"', () => {
    expect(formatDate('not-a-date', 'en')).toBe('—');
    expect(formatDateTime('not-a-date', 'he')).toBe('—');
  });
});
