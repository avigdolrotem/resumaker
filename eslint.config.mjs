// Root ESLint flat config (ESLint v9+).
//
// One config covers the whole monorepo. Per-package configs were dropped
// because v9's flat config makes per-directory inheritance the natural
// pattern via `files:` selectors.
//
// Scope:
//   - apps/web         → adds Next.js core-web-vitals + React rules
//   - packages/*       → TypeScript baseline only
//   - tests/**         → TypeScript baseline, looser on `any`
//
// Notes:
//   - Next 16 removed `next lint`; apps/web/package.json now calls
//     `eslint .` directly which picks up this config.
//   - `next/typescript` is rolled into core-web-vitals so we don't need
//     to import it separately.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

export default [
  // Ignores apply globally and must come before any matching config.
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.terraform/**',
      '**/drizzle/**',
      '**/*.tsbuildinfo',
      '**/ruvector.db',
    ],
  },

  // Baseline for every TS/JS source file.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Shared rules — apply to every TS/TSX file in the repo.
  // Default to "browser + node + es2024" globals so we don't flag fetch,
  // URL, process, console, etc. as undefined. Service-worker globals
  // (self, caches, clients) are added by the sw.js-specific block.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // apps/web — Next.js core-web-vitals + React Hooks rules.
  // We load the plugin manually instead of `eslint-config-next` because
  // the FlatCompat conversion is fragile and the plugin alone covers the
  // rules we actually care about.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // We intentionally use plain <a> for locale-switch links in the
      // marketing layout. A full-page navigation is correct there — a
      // new locale means a different bundle + different RSC tree, and
      // <Link> would client-side-route into the wrong locale's data
      // before the server re-routes. Downgrade to warn so accidental
      // misuse elsewhere is still surfaced.
      '@next/next/no-html-link-for-pages': 'warn',
      // `\-` inside a character class is technically redundant in JS
      // regex but improves readability (signals intent that `-` is a
      // literal, not a range). Downgrade so legitimate uses don't fail
      // the build.
      'no-useless-escape': 'warn',
    },
  },

  // Tests — a bit looser on `any` (mocks often need it) + allow console.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'no-useless-escape': 'off',
    },
  },

  // Build/config files — Node globals, allow require().
  {
    files: [
      '**/*.config.{ts,mts,cts,js,mjs,cjs}',
      'eslint.config.mjs',
      '**/scripts/**/*.{js,mjs,ts}',
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Service worker — its own global scope: `self` is the SW context,
  // `caches`, `clients`, etc. live on it.
  {
    files: ['**/public/sw.js', '**/public/*-sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: {
        ...globals.serviceworker,
      },
    },
  },
];
