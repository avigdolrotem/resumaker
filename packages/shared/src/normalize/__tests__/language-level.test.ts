import { describe, it, expect } from 'vitest';
import { normalizeLanguageLevel } from '../language-level';

describe('normalizeLanguageLevel', () => {
  it('passes through valid enum values', () => {
    expect(normalizeLanguageLevel('native')).toBe('native');
    expect(normalizeLanguageLevel('fluent')).toBe('fluent');
    expect(normalizeLanguageLevel('professional')).toBe('professional');
    expect(normalizeLanguageLevel('conversational')).toBe('conversational');
    expect(normalizeLanguageLevel('basic')).toBe('basic');
  });

  it('is case-insensitive on enum values', () => {
    expect(normalizeLanguageLevel('Native')).toBe('native');
    expect(normalizeLanguageLevel('NATIVE')).toBe('native');
    expect(normalizeLanguageLevel('Fluent')).toBe('fluent');
  });

  it('maps CEFR codes (C1/B2/A1...)', () => {
    expect(normalizeLanguageLevel('C2')).toBe('fluent');
    expect(normalizeLanguageLevel('C1')).toBe('professional');
    expect(normalizeLanguageLevel('B2')).toBe('professional');
    expect(normalizeLanguageLevel('B1')).toBe('conversational');
    expect(normalizeLanguageLevel('A2')).toBe('basic');
    expect(normalizeLanguageLevel('A1')).toBe('basic');
  });

  it('maps common English descriptors', () => {
    expect(normalizeLanguageLevel('Advanced')).toBe('professional');
    expect(normalizeLanguageLevel('Proficient')).toBe('professional');
    expect(normalizeLanguageLevel('Intermediate')).toBe('conversational');
    expect(normalizeLanguageLevel('Beginner')).toBe('basic');
    expect(normalizeLanguageLevel('Elementary')).toBe('basic');
    expect(normalizeLanguageLevel('Mother tongue')).toBe('native');
  });

  it('defaults unknown / empty / nullish to "professional"', () => {
    expect(normalizeLanguageLevel('whatever')).toBe('professional');
    expect(normalizeLanguageLevel('')).toBe('professional');
    expect(normalizeLanguageLevel(undefined)).toBe('professional');
    expect(normalizeLanguageLevel(null)).toBe('professional');
  });

  it('trims whitespace', () => {
    expect(normalizeLanguageLevel('  native  ')).toBe('native');
    expect(normalizeLanguageLevel('\tC1\n')).toBe('professional');
  });
});
