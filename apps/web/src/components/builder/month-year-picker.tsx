'use client';

import { useEffect, useState } from 'react';

/**
 * MM/YYYY date picker — two selects emitting a `YYYY-MM` string.
 * Ported from the job-app's profile builder (`frontend/app/(dashboard)/profile/page.tsx`)
 * and themed with our semantic tokens so it works in light + dark.
 *
 * Use cases:
 *   - Experience start / end dates ("Mar 2022" — "Present")
 *   - Education start / end dates
 *   - Project start / end dates
 *   - Certification award date (no end date needed)
 *
 * When `disabled` is true (typically when the parent's "I currently
 * work here" checkbox is on), the selects gray out and the placeholder
 * flips to "Present" so the user understands why they can't pick.
 *
 * The component is controlled — pass `value` (YYYY-MM or empty string)
 * and `onChange`. Internal state mirrors the value so empty/partial
 * selections don't drop digits when the user clicks one select then
 * the other.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 65-year range so anyone alive can pick a graduation year + a few in
// the future for planned events. Latest year first so the most
// commonly-picked years are at the top of the dropdown.
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 65 }, (_, i) => CURRENT_YEAR + 3 - i);

export function MonthYearPicker({
  label,
  value = '',
  onChange,
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const [year, setYear] = useState(() => value.split('-')[0] ?? '');
  const [month, setMonth] = useState(() => value.split('-')[1] ?? '');

  // Sync from outside (e.g. when parent resets form or hydrates from
  // an existing resume).
  useEffect(() => {
    setYear(value.split('-')[0] ?? '');
    setMonth(value.split('-')[1] ?? '');
  }, [value]);

  function handleMonth(m: string) {
    setMonth(m);
    if (m && year) onChange(`${year}-${m}`);
    else if (!m) onChange('');
  }

  function handleYear(y: string) {
    setYear(y);
    if (y && month) onChange(`${y}-${month}`);
    else if (!y) onChange('');
  }

  // The base + disabled classes use semantic tokens so the picker
  // works in light + both dark variants.
  const selectClass = `flex-1 rounded-md border px-2 py-2 text-sm shadow-sm transition-colors
    focus:outline-none focus:ring-2 focus:ring-brand-500
    ${
      disabled
        ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
        : 'border-input bg-background text-foreground hover:border-brand-300'
    }`;

  return (
    <div>
      <label className="text-foreground mb-1 block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => handleMonth(e.target.value)}
          disabled={disabled}
          className={selectClass}
          aria-label={`${label} — month`}
        >
          <option value="">{disabled ? 'Present' : 'Month'}</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, '0')}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => handleYear(e.target.value)}
          disabled={disabled}
          className={selectClass}
          aria-label={`${label} — year`}
        >
          <option value="">{disabled ? '—' : 'Year'}</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Pretty-print a `YYYY-MM` string as "Mar 2022". Empty string → empty
 * string. Non-YYYY-MM strings pass through unchanged (legacy free-text
 * dates from older resumes).
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
