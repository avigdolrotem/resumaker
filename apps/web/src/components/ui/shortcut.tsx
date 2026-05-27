'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Logical key tokens. 'mod' renders as ⌘ on Mac, Ctrl elsewhere — the
 * single biggest source of "looks broken on Windows" bugs in this app.
 * Spell every shortcut with these tokens; never type raw ⌘ ⌥ ⇧ ⌃ into
 * source.
 */
export type ShortcutKey =
  | 'mod' // ⌘ on Mac / Ctrl on Windows/Linux
  | 'ctrl'
  | 'alt' // ⌥ on Mac / Alt elsewhere
  | 'shift'
  | 'enter'
  | 'esc'
  | string; // single letter, e.g. 'K'

interface ShortcutProps {
  keys: ShortcutKey[];
  className?: string;
}

/**
 * Detects Mac at module load and caches. Server-rendered, then
 * re-rendered after hydration; both renderings use platform-neutral
 * Ctrl-style by default so the HTML payload doesn't bake in a glyph
 * that doesn't match the user's actual OS.
 */
function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent;
    // `navigator.platform` is deprecated; navigator.userAgentData is
    // not yet on all browsers; userAgent is the lowest-common-
    // denominator stable signal.
    setIsMac(/Mac|iPhone|iPad|iPod/.test(ua));
  }, []);
  return isMac;
}

/**
 * Cross-platform keyboard-shortcut renderer. Use anywhere ⌘K /
 * ⌥⌘P / ⏎ would otherwise be typed as literal glyphs.
 *
 * Usage:
 *   <Shortcut keys={['mod', 'K']} />            // ⌘K on Mac, Ctrl K on Windows/Linux
 *   <Shortcut keys={['shift', 'enter']} />
 *   <Shortcut keys={['mod', 'shift', 'P']} />
 *
 * Renders as a `<kbd>` so it inherits the existing kbd styling
 * (border, monospace, bg-muted) without each caller needing to wrap
 * it. Locale-agnostic — the labels are universal symbols + ASCII.
 */
export function Shortcut({ keys, className }: ShortcutProps) {
  const isMac = useIsMac();

  function render(key: ShortcutKey): string {
    switch (key) {
      case 'mod':
        return isMac ? '⌘' : 'Ctrl';
      case 'ctrl':
        return isMac ? '⌃' : 'Ctrl';
      case 'alt':
        return isMac ? '⌥' : 'Alt';
      case 'shift':
        return isMac ? '⇧' : 'Shift';
      case 'enter':
        return '↵'; // universal — present in basic Latin extended; renders everywhere
      case 'esc':
        return 'Esc';
      default:
        return key.toUpperCase();
    }
  }

  // On Mac, modifier glyphs are tight (⌘K). On Windows/Linux, Ctrl+K
  // reads better with a space separator between the modifier word and
  // the letter. We use a narrow space only on non-Mac to avoid the
  // glyph-jamming-into-letter look ("CtrlK").
  const separator = isMac ? '' : ' ';

  return (
    <kbd
      className={cn(
        'border-border bg-muted inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none',
        className,
      )}
    >
      {keys.map((k, i) => (
        <span key={i}>
          {i > 0 ? separator : ''}
          {render(k)}
        </span>
      ))}
    </kbd>
  );
}
