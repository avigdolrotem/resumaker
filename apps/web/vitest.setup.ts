/**
 * Vitest global setup. Provides the minimum env vars required for
 * `@/lib/env` to validate, so tests can import modules that transitively
 * pull in env without each test having to stub them.
 *
 * Real production env never sees these — vitest sets them before user
 * code runs.
 */

// process.env in TS 5+ has typed keys; cast to break the readonly typing.
// We force-overwrite (not ??=) so a shell env with an invalid key shape
// doesn't poison test runs.
const e = process.env as Record<string, string | undefined>;
e.NODE_ENV = 'test';
e.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
e.ANTHROPIC_API_KEY = 'sk-ant-test-key-for-unit-tests-only';
e.BETTER_AUTH_SECRET = 'test-secret-must-be-at-least-32-chars-long-yep';
e.BETTER_AUTH_URL = 'http://localhost:3000';
