import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the real Jira instance, read-only. They are slow on
 * purpose: a cold dashboard load is ~5s of real API calls, and that is exactly
 * the path worth testing.
 *
 * Port 3100 so it never fights with a dev server you already have open.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    // The UI follows the browser language; pin it so the assertions can be
    // written against one language, with a separate test for switching.
    locale: 'it-IT',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A production build, not `next dev`: only one dev server is allowed per
    // directory, so using dev here would fail whenever one is already open.
    command: 'pnpm build && pnpm start --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 240_000,
    // Hidden rows are persisted to a file; keep the tests out of the real one.
    env: {
      DISMISSALS_FILE: '.playwright-dismissals.json',
      SEEN_FILE: '.playwright-seen.json',
    },
  },
});
