/**
 * ATS Scoring Engine.
 *
 * Compares a generated resume against the original job description.
 * Returns a 0-100 score, the matched/missing keywords, and improvement suggestions.
 */

import type { ATSScore, Resume } from '@resumaker/shared';

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'could',
  'this',
  'that',
  'these',
  'those',
  'we',
  'you',
  'they',
  'i',
  'me',
  'my',
  'our',
  'your',
  'his',
  'her',
  'its',
  'their',
  'as',
  'if',
  'then',
  'so',
  'than',
  'not',
  'only',
  'own',
  'same',
  'about',
  'above',
  'after',
  'all',
  'also',
  'any',
  'because',
  'before',
  'between',
  'both',
  'can',
  'each',
  'either',
  'from',
  'how',
  'into',
  'just',
  'like',
  'many',
  'more',
  'most',
  'much',
  'never',
  'new',
  'now',
  'often',
  'other',
  'over',
  'out',
  'per',
  'some',
  'too',
  'under',
  'up',
  'us',
  'use',
  'used',
  'using',
  'very',
  'when',
  'where',
  'while',
  'who',
  'why',
  'work',
  'years',
  'year',
  'role',
  'team',
  'looking',
  'experience',
  'position',
  'של',
  'את',
  'על',
  'אל',
  'מן',
  'אם',
  'או',
  'גם',
  'כי',
  'לא',
  'זה',
  'הוא',
  'היא',
  'אנו',
  'אתה',
  'הם',
  'הן',
  'אני',
  'אנחנו',
  'יש',
  'אין',
  'היה',
  'עם',
  'אחר',
  'אחרי',
  'לפני',
  'בין',
  'בתוך',
  'כל',
  'איזה',
  'מה',
  'איך',
  'איפה',
  'מתי',
  'אבל',
  'רק',
  'עוד',
  'כבר',
  'יותר',
  'פחות',
  'מחפשים',
  'משרה',
  'תפקיד',
  'ניסיון',
  'שנות',
  'שנים',
]);

const HEBREW_REGEX = /[֐-׿]/;

const TECH_KEYWORDS_BOOST = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'react',
  'nextjs',
  'next.js',
  'vue',
  'svelte',
  'angular',
  'node',
  'nodejs',
  'express',
  'fastify',
  'django',
  'flask',
  'fastapi',
  'rails',
  'spring',
  'aws',
  'gcp',
  'azure',
  'kubernetes',
  'k8s',
  'docker',
  'terraform',
  'opentofu',
  'ansible',
  'helm',
  'argocd',
  'jenkins',
  'gitlab',
  'github',
  'cicd',
  'ci/cd',
  'postgres',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'elasticsearch',
  'dynamodb',
  'graphql',
  'rest',
  'grpc',
  'kafka',
  'microservices',
  'serverless',
  'lambda',
];

interface KeywordExtractResult {
  keyword: string;
  weight: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeywords(text: string): KeywordExtractResult[] {
  const isHebrew = HEBREW_REGEX.test(text);
  const normalized = text.toLowerCase();

  const techMatches = new Set<string>();
  for (const tk of TECH_KEYWORDS_BOOST) {
    const re = new RegExp(`\\b${escapeRegex(tk)}\\b`, 'gi');
    if (re.test(normalized)) techMatches.add(tk.toLowerCase());
  }

  const tokens = isHebrew
    ? normalized.split(/[^֐-׿a-z0-9+#./-]+/)
    : normalized.split(/[^a-z0-9+#./-]+/);

  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (STOP_WORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (!a || !b || a.length < 3 || b.length < 3) continue;
    if (STOP_WORDS.has(a) || STOP_WORDS.has(b)) continue;
    const bigram = `${a} ${b}`;
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }

  const results: KeywordExtractResult[] = [];

  for (const tk of techMatches) {
    results.push({ keyword: tk, weight: 5 });
  }

  for (const [bg, count] of bigrams) {
    if (count >= 2) results.push({ keyword: bg, weight: 3 });
  }

  const sortedSingle = [...freq.entries()]
    .filter(([w]) => !techMatches.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  for (const [w, count] of sortedSingle) {
    if (count >= 2) results.push({ keyword: w, weight: count });
  }

  return results.slice(0, 60);
}

function matchKeyword(keyword: string, resumeText: string): boolean {
  const escaped = escapeRegex(keyword);
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return re.test(resumeText);
}

export function scoreResume(resume: Resume, jobDescription: string): ATSScore {
  const keywords = extractKeywords(jobDescription);

  const resumeText = [
    resume.summary,
    ...resume.experience.flatMap((e) => [
      e.title,
      e.company,
      e.description ?? '',
      ...(e.highlights ?? []),
    ]),
    ...resume.education.flatMap((e) => [e.institution, e.degree, e.field ?? '']),
    ...resume.skills,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const { keyword, weight } of keywords) {
    totalWeight += weight;
    if (matchKeyword(keyword, resumeText)) {
      matched.push(keyword);
      matchedWeight += weight;
    } else {
      missing.push(keyword);
    }
  }

  const overall = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  const suggestions: ATSScore['suggestions'] = [];

  const topMissing = missing.slice(0, 5);
  if (topMissing.length > 0) {
    suggestions.push({
      type: 'keyword',
      severity: 'medium',
      message: `Consider adding these keywords from the job description: ${topMissing.join(', ')}`,
    });
  }

  if (resume.summary.length < 100) {
    suggestions.push({
      type: 'content',
      severity: 'low',
      message: 'Summary is short — aim for 2-4 sentences highlighting your value',
    });
  }

  if (resume.experience.length === 0) {
    suggestions.push({
      type: 'structure',
      severity: 'high',
      message: 'No experience entries — add at least one role',
    });
  } else {
    const hasHighlights = resume.experience.every((e) => (e.highlights?.length ?? 0) > 0);
    if (!hasHighlights) {
      suggestions.push({
        type: 'content',
        severity: 'medium',
        message: 'Some experience entries lack bullet points — add measurable achievements',
      });
    }
  }

  if (resume.skills.length < 5) {
    suggestions.push({
      type: 'structure',
      severity: 'low',
      message: 'List more skills — at least 5-10 relevant ones for ATS scanning',
    });
  }

  return {
    overall,
    matched_keywords: matched,
    missing_keywords: missing.slice(0, 20),
    suggestions,
  };
}
