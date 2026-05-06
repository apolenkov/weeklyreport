/**
 * Standalone Playwright config for regression sweeps that target
 * the live dev stack at http://localhost:3000 (web) +
 * http://localhost:3002 (api). No webServer block — the user's
 * existing `pnpm dev` process is reused.
 *
 * No `setup` dependency because each spec logs in inline via
 * /auth/dev-login (cookie scoped to the web origin).
 */

import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: '.',
  outputDir: '../../.results/regression-agent-b',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../../../.planning/regression/agent-b-test-results/results.json' }],
  ],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
