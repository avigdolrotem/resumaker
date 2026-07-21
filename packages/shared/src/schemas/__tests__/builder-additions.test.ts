import { describe, it, expect } from 'vitest';
import {
  ResumeSchema,
  ExperienceSchema,
  EducationSchema,
  ProjectSchema,
  ContactSchema,
} from '../index';

/**
 * Schema additions for the 2026-05-25 builder rework.
 * Spec: docs/superpowers/specs/2026-05-25-builder-rework-design.md §7
 */
describe('builder-rework schema additions', () => {
  describe('ExperienceSchema.is_current', () => {
    it('accepts is_current=true', () => {
      const parsed = ExperienceSchema.parse({
        company: 'Stripe',
        title: 'Engineer',
        start_date: '2022-01',
        end_date: null,
        highlights: [],
        is_current: true,
      });
      expect(parsed.is_current).toBe(true);
    });

    it('defaults is_current to false when omitted', () => {
      const parsed = ExperienceSchema.parse({
        company: 'Stripe',
        title: 'Engineer',
        start_date: '2022-01',
        end_date: null,
        highlights: [],
      });
      expect(parsed.is_current).toBe(false);
    });
  });

  describe('EducationSchema.is_current', () => {
    it('accepts is_current=true (currently studying)', () => {
      const parsed = EducationSchema.parse({
        institution: 'MIT',
        degree: 'BSc',
        start_date: '2020-09',
        end_date: null,
        is_current: true,
      });
      expect(parsed.is_current).toBe(true);
    });

    it('defaults is_current to false when omitted', () => {
      const parsed = EducationSchema.parse({
        institution: 'MIT',
        degree: 'BSc',
        start_date: '2020-09',
        end_date: '2024-06',
      });
      expect(parsed.is_current).toBe(false);
    });
  });

  describe('ProjectSchema.is_ongoing', () => {
    it('accepts is_ongoing=true', () => {
      const parsed = ProjectSchema.parse({
        name: 'Side hustle',
        description: 'A thing I built',
        is_ongoing: true,
      });
      expect(parsed.is_ongoing).toBe(true);
    });

    it('defaults is_ongoing to false when omitted', () => {
      const parsed = ProjectSchema.parse({
        name: 'Side hustle',
        description: 'A thing I built',
      });
      expect(parsed.is_ongoing).toBe(false);
    });
  });

  describe('certifications.credential_url', () => {
    const certs = ResumeSchema.shape.certifications.unwrap();

    it('accepts a valid credential_url', () => {
      const [first] = certs.parse([
        { name: 'AWS SAA', issuer: 'Amazon', credential_url: 'https://example.com/cert/abc' },
      ]);
      expect(first?.credential_url).toBe('https://example.com/cert/abc');
    });

    it('rejects a malformed credential_url', () => {
      expect(() =>
        certs.parse([{ name: 'AWS SAA', issuer: 'Amazon', credential_url: 'not-a-url' }]),
      ).toThrow();
    });

    it('accepts certifications without credential_url (still optional)', () => {
      const [first] = certs.parse([{ name: 'AWS SAA', issuer: 'Amazon' }]);
      expect(first?.credential_url).toBeUndefined();
    });
  });

  describe('optionalUrl bare-domain normalization (contact.linkedin/github/website)', () => {
    // Resumes overwhelmingly write these as "linkedin.com/in/user", not
    // "https://linkedin.com/in/user" — a real import bug where this
    // failed validation and silently killed the entire profile save.
    it('normalizes a bare domain to https://', () => {
      const parsed = ContactSchema.parse({
        name: 'Jane Doe',
        linkedin: 'linkedin.com/in/janedoe',
      });
      expect(parsed.linkedin).toBe('https://linkedin.com/in/janedoe');
    });

    it('leaves an already-schemed URL unchanged', () => {
      const parsed = ContactSchema.parse({
        name: 'Jane Doe',
        github: 'https://github.com/janedoe',
      });
      expect(parsed.github).toBe('https://github.com/janedoe');
    });

    it('still rejects text with no scheme and no dotted host', () => {
      expect(() => ContactSchema.parse({ name: 'Jane Doe', website: 'not-a-url' })).toThrow();
    });

    it('still treats empty/placeholder strings as not provided', () => {
      const parsed = ContactSchema.parse({ name: 'Jane Doe', linkedin: 'n/a' });
      expect(parsed.linkedin).toBeUndefined();
    });
  });

  describe('languages.level enum', () => {
    const langs = ResumeSchema.shape.languages.unwrap();

    it.each(['native', 'fluent', 'professional', 'conversational', 'basic'] as const)(
      'accepts %s',
      (level) => {
        const [first] = langs.parse([{ name: 'English', level }]);
        expect(first?.level).toBe(level);
      },
    );

    it('rejects free-form level strings (use normalizeLanguageLevel for legacy)', () => {
      expect(() => langs.parse([{ name: 'English', level: 'B2' }])).toThrow();
      expect(() => langs.parse([{ name: 'English', level: 'Advanced' }])).toThrow();
    });
  });
});
