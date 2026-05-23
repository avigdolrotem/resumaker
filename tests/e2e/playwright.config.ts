import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for resumaker E2E tests.
 *
 * Assumes the dev server (or a preview build) is running at BASE_URL.
 * Locally: `pnpm --filter @resumaker/web dev` in another terminal.
 * CI: webServer block boots the build before tests.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './specs',
  fullyParallel: !isCi,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  ...(isCi ? { workers: 1 } : {}),
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: isCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // mobile + safari can be added once the suite stabilizes
  ],

  // Only auto-start the server in CI; locally we rely on `pnpm dev` being up
  ...(isCi
    ? {
        webServer: {
          command: 'pnpm --filter @resumaker/web start',
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }
    : {}),
});
