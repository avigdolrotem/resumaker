/**
 * Bundled list of common tech skills for the builder's skill
 * autocomplete dropdown. About 200 entries chosen to cover most
 * tech-resume use cases. Not exhaustive — users can still add
 * anything that isn't in the list.
 *
 * Sourced from JSON so the list can be edited / reviewed by humans
 * without TypeScript noise. Bundled at build time, not fetched.
 */
import commonSkills from './common-skills.json';

export const COMMON_SKILLS: readonly string[] = commonSkills;
