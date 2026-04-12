import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3101;
const WEB_PORT = 3100;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: 'e2e',
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
  },

  projects: [
    // Auth setup -- runs first, creates per-role storageState files
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Journey tests run with per-role auth via fixtures
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: [
    {
      command: `node --import @swc-node/register/esm-register ../api/src/main.ts`,
      url: `${API_URL}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(API_PORT),
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://customreport:localdev@localhost:5432/customreport_test',
        REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
        REDIS_PORT: process.env.REDIS_PORT ?? '6379',
        AUTH_DEV_MODE: 'true',
        AUTH_JWT_SECRET: 'test-secret-at-least-32-characters-long!!',
        FRONTEND_URL: WEB_URL,
        PDF_BASE_URL: WEB_URL,
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `pnpm --filter @customreport/web exec next start -p ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
        AUTH_DEV_MODE: 'true',
        NODE_ENV: 'test',
      },
    },
  ],
});
