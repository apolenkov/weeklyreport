import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const API_PORT = Number(process.env.E2E_API_PORT ?? 3002);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3005);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

if (!process.env.E2E_DATABASE_URL) {
  throw new Error(
    'E2E_DATABASE_URL must be set for integration tests. ' +
      'Use a dedicated database (e.g., customreport_e2e), NEVER the dev DATABASE_URL. ' +
      'See .env.test.example.',
  );
}

export default defineConfig({
  testDir: path.join(__dirname, 'e2e/integration'),
  outputDir: path.join(__dirname, 'e2e/integration/.results'),
  globalSetup: path.join(__dirname, 'e2e/integration/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'e2e/integration/global-teardown.ts'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared DB state
  workers: 1, // CRITICAL: tests mutate the same seed
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0, // 0 locally — failure should be debugged
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium-integration',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @customreport/api dev',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        DATABASE_URL: process.env.E2E_DATABASE_URL,
        AUTH_DEV_MODE: 'true', // required so /auth/dev-login route is mounted
        AUTH_JWT_SECRET:
          process.env.AUTH_JWT_SECRET ?? 'test-secret-must-be-32-chars-or-more!!',
        FRONTEND_URL: WEB_URL,
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn', // keep test output readable
      },
    },
    {
      command: `pnpm --filter @customreport/web exec next dev -p ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
        // INTENTIONALLY NOT SET: NEXT_PUBLIC_AUTH_STUB.
        // Integration tests rely on real JWT cookies via /auth/dev-login.
        // Setting AUTH_STUB would defeat auth-guard tests.
        NODE_ENV: 'test',
      },
    },
  ],
});
