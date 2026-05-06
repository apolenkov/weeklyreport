/**
 * Playwright config used ONLY for the live-stack regression sweep.
 *
 * - Targets :3000 / :3002 (already up via `pnpm dev`)
 * - Does NOT spawn webServer — we attach to the running stack
 * - Does NOT depend on auth.setup — each spec authenticates inline via
 *   /auth/dev-login (the spec creates per-role browser contexts)
 *
 * Usage:
 *   pnpm --filter @customreport/web exec playwright test \
 *     --config=playwright.regression.config.ts \
 *     e2e/regression/agent-c.spec.ts
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/regression',
  outputDir: '../../.planning/regression/agent-c-test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../.planning/regression/agent-c-test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
