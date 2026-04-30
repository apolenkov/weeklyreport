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
    // MOB-01 (Phase 30-04): mobile-ios and mobile-android projects exercise
    // the no-horizontal-scroll contract at 390x844 / 412x915. Only the
    // mobile-no-horizontal-scroll spec runs in these projects (the spec
    // self-skips on chromium-integration).
    {
      name: 'mobile-ios',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @customreport/api dev',
      url: `${API_URL}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 360_000,
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
      timeout: 360_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
        // FORCE-OVERRIDE NEXT_PUBLIC_AUTH_STUB — `.env` at repo root sets it
        // to 'true' for local dev convenience, and Next.js's turbopack.root
        // points at the monorepo root so that file is loaded automatically.
        // The integration suite must exercise the real proxy.ts auth guard
        // via /auth/dev-login JWT cookies; AUTH_STUB=true would short-circuit
        // the redirect logic and break auth-guards.integration.spec.ts.
        NEXT_PUBLIC_AUTH_STUB: 'false',
        NODE_ENV: 'test',
      },
    },
  ],
});
