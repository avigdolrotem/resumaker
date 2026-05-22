/**
 * Post-LLM output validation.
 *
 * Ensures LLM output matches expected schema and contains no
 * injection patterns leaked back.
 */

import { ResumeSchema, type Resume, ValidationError } from '@resumaker/shared';
import { sanitizeInput } from './input-filter';

export interface ValidateResult {
  valid: boolean;
  resume?: Resume;
  errors: string[];
  warnings: string[];
}

export function validateOutput(rawOutput: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Parse JSON if string
  let parsed: unknown;
  if (typeof rawOutput === 'string') {
    try {
      parsed = JSON.parse(rawOutput);
    } catch (e) {
      return {
        valid: false,
        errors: [`Output is not valid JSON: ${(e as Error).message}`],
        warnings: [],
      };
    }
  } else {
    parsed = rawOutput;
  }

  // 2. Schema validation
  const result = ResumeSchema.safeParse(parsed);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      warnings: [],
    };
  }

  const resume = result.data;

  // 3. Check for injection patterns leaked into resume
  const stringValues: string[] = [
    resume.summary,
    ...resume.experience.flatMap((e) => [e.description ?? '', ...e.highlights]),
    ...resume.education.map((e) => e.description ?? ''),
    ...resume.skills,
  ].filter((s) => s.length > 0);

  for (const text of stringValues) {
    const sanitized = sanitizeInput(text);
    if (sanitized.detections.length > 0) {
      warnings.push(
        `Suspicious pattern in resume output: ${sanitized.detections.map((d) => d.match).join(', ')}`,
      );
    }
  }

  // 4. Sanity checks
  if (resume.experience.length === 0) warnings.push('Resume has no experience entries');
  if (resume.skills.length === 0) warnings.push('Resume has no skills listed');

  return { valid: true, resume, errors, warnings };
}

/**
 * Strict version that throws on any failure.
 */
export function parseAndValidate(raw: unknown): Resume {
  const result = validateOutput(raw);
  if (!result.valid || !result.resume) {
    throw new ValidationError(`Output validation failed: ${result.errors.join('; ')}`);
  }
  return result.resume;
}
