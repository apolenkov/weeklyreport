import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  testIgnore: ['integration/**'],
  outputDir: 'e2e/.results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },

  projects: [
    // Auth setup -- writes storage state files (no-op while pages use mock data)
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Journey tests run after setup
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    command: `pnpm --filter @customreport/web exec next dev -p ${WEB_PORT}`,
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:3101`,
      AUTH_DEV_MODE: 'true',
      NODE_ENV: 'test',
    },
  },
});
