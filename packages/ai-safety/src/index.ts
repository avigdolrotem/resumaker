/**
 * AI Safety Layer
 *
 * Multi-layer defense against prompt injection, output abuse,
 * cost overruns, and content policy violations.
 *
 * See: docs/AI_SAFETY.md
 */

export { sanitizeInput, type SanitizeResult } from './input-filter.js';
export { validateOutput, type ValidateResult } from './output-validator.js';
export { buildPrompt, type PromptInput } from './prompt-builder.js';
