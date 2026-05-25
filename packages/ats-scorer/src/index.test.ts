import { describe, it, expect } from 'vitest';
import { scoreResume } from './index';
import type { Resume } from '@resumaker/shared';

const baseResume: Resume = {
  metadata: { language: 'en', generated_at: '2026-01-01T00:00:00Z', template: 'modern-1' },
  contact: { name: 'Test User', email: 'test@example.com' },
  summary: 'Senior backend engineer with 8 years of Python experience building scalable APIs.',
  experience: [
    {
      company: 'Acme',
      title: 'Senior Engineer',
      start_date: '2020-01-01',
      end_date: null,
      highlights: [
        'Built microservices on AWS Lambda',
        'Migrated from MySQL to Postgres',
        'Led team of 4 engineers',
      ],
      is_current: true,
    },
  ],
  education: [
    {
      institution: 'Technion',
      degree: 'BSc Computer Science',
      start_date: '2014-10-01',
      end_date: '2018-06-30',
      is_current: false,
    },
  ],
  skills: ['Python', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes'],
};

describe('scoreResume', () => {
  it('returns 0 score when JD has no extractable keywords', () => {
    const result = scoreResume(baseResume, 'a a a a a a a');
    expect(result.overall).toBe(0);
  });

  it('returns high score when resume contains all JD tech terms', () => {
    const jd = `Looking for a senior Python engineer with AWS, Docker, Kubernetes experience.
                Postgres knowledge required.`;
    const result = scoreResume(baseResume, jd);
    expect(result.overall).toBeGreaterThan(60);
  });

  it('lists missing keywords when resume lacks them', () => {
    const jd = `Senior Rust engineer with Kafka and GraphQL experience needed. Must know Go.`;
    const result = scoreResume(baseResume, jd);
    expect(result.missing_keywords).toContain('rust');
    expect(result.missing_keywords).toContain('kafka');
    expect(result.missing_keywords).toContain('graphql');
  });

  it('matches case-insensitively', () => {
    const jd = 'PYTHON developer needed';
    const result = scoreResume(baseResume, jd);
    expect(result.matched_keywords).toContain('python');
  });

  it('handles Hebrew job descriptions', () => {
    const jd = 'מחפשים מהנדס בכיר ב-Python עם ניסיון ב-AWS ו-Docker';
    const result = scoreResume(baseResume, jd);
    expect(result.matched_keywords.length).toBeGreaterThan(0);
  });

  it('suggests adding keywords when score is low', () => {
    const jd = 'Looking for Rust, Go, Kafka, GraphQL, gRPC experts';
    const result = scoreResume(baseResume, jd);
    const keywordSuggestion = result.suggestions.find((s) => s.type === 'keyword');
    expect(keywordSuggestion).toBeDefined();
    expect(keywordSuggestion?.message).toContain('keywords');
  });

  it('flags too-short summary', () => {
    const shortSummaryResume = { ...baseResume, summary: 'I code.' };
    const result = scoreResume(shortSummaryResume, 'Python engineer');
    const contentSuggestion = result.suggestions.find(
      (s) => s.type === 'content' && s.message.toLowerCase().includes('summary'),
    );
    expect(contentSuggestion).toBeDefined();
  });

  it('flags too few skills', () => {
    const fewSkillsResume = { ...baseResume, skills: ['Python', 'AWS'] };
    const result = scoreResume(fewSkillsResume, 'Python engineer');
    const structureSuggestion = result.suggestions.find(
      (s) => s.type === 'structure' && s.message.toLowerCase().includes('skills'),
    );
    expect(structureSuggestion).toBeDefined();
  });

  it('flags experience entries missing bullet points', () => {
    const noBulletsResume: Resume = {
      ...baseResume,
      experience: [
        {
          company: 'X',
          title: 'Y',
          start_date: '2020-01-01',
          end_date: null,
          highlights: [],
          is_current: true,
        },
      ],
    };
    const result = scoreResume(noBulletsResume, 'Python engineer');
    const contentSuggestion = result.suggestions.find(
      (s) => s.type === 'content' && s.message.toLowerCase().includes('bullet'),
    );
    expect(contentSuggestion).toBeDefined();
  });

  it('handles empty experience gracefully (no crash)', () => {
    const noExpResume: Resume = { ...baseResume, experience: [] };
    const result = scoreResume(noExpResume, 'Python engineer');
    expect(result).toBeDefined();
    const structureSuggestion = result.suggestions.find(
      (s) => s.severity === 'high' && s.message.toLowerCase().includes('experience'),
    );
    expect(structureSuggestion).toBeDefined();
  });

  it('returns capped missing_keywords (max 20)', () => {
    const longJd = Array.from({ length: 50 }, (_, i) => `unicorn${i}`)
      .join(' ')
      .repeat(3);
    const result = scoreResume(baseResume, longJd);
    expect(result.missing_keywords.length).toBeLessThanOrEqual(20);
  });

  it('ignores common English stop words in extraction', () => {
    const jd = 'the the the the python the the the the';
    const result = scoreResume(baseResume, jd);
    // 'the' should never appear in matched/missing
    expect(result.matched_keywords).not.toContain('the');
    expect(result.missing_keywords).not.toContain('the');
  });

  it('ignores common Hebrew stop words', () => {
    const jd = 'של של של על על אל אל Python';
    const result = scoreResume(baseResume, jd);
    expect(result.matched_keywords).not.toContain('של');
    expect(result.missing_keywords).not.toContain('של');
  });
});
