import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
// Side-effect import: ensure loopback health probes bypass any corporate proxy
// (see e2e/no-proxy-localhost.ts) before the webServer probes run.
import "./no-proxy-localhost";

const API_PORT = Number(process.env.E2E_API_PORT ?? 3102);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3105);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const BULLMQ_PREFIX =
  process.env.E2E_BULLMQ_PREFIX ??
  `customreport-e2e-${process.pid}-${Date.now()}`;

// Keep API helper fixtures and any auth helper fallbacks in sync with
// the integration web-server port. Tests are launched before web servers,
// so we seed this in the test process to avoid accidental fallback to
// host defaults (e.g., 3002).
if (!process.env.E2E_API_PORT) {
  process.env.E2E_API_PORT = String(API_PORT);
}
if (!process.env.E2E_WEB_PORT) {
  process.env.E2E_WEB_PORT = String(WEB_PORT);
}
if (!process.env.NEXT_PUBLIC_API_URL) {
  process.env.NEXT_PUBLIC_API_URL = API_URL;
}

if (!process.env.E2E_DATABASE_URL) {
  throw new Error(
    "E2E_DATABASE_URL must be set for integration tests. " +
      "Use a dedicated database (e.g., customreport_e2e), NEVER the dev DATABASE_URL. " +
      "See .env.test.example.",
  );
}

export default defineConfig({
  testDir: path.join(__dirname, "integration"),
  outputDir: path.join(__dirname, "integration/.results"),
  globalSetup: path.join(__dirname, "integration/global-setup.ts"),
  globalTeardown: path.join(__dirname, "integration/global-teardown.ts"),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared DB state
  workers: 1, // CRITICAL: tests mutate the same seed
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0, // 0 locally — failure should be debugged
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium-integration",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@MOB-/,
    },
    // MOB-01/MOB-AUDIT: mobile projects run only specs tagged @MOB-.
    {
      name: "mobile-ios",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
      grep: /@MOB-/,
    },
    {
      name: "mobile-android",
      use: { ...devices["Pixel 7"] },
      grep: /@MOB-/,
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @customreport/api dev",
      url: `${API_URL}/health/ready`,
      reuseExistingServer: false,
      timeout: 360_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        DATABASE_URL: process.env.E2E_DATABASE_URL,
        AUTH_DEV_MODE: "true", // required so /auth/dev-login route is mounted
        AUTH_JWT_SECRET:
          process.env.AUTH_JWT_SECRET ??
          "test-secret-must-be-32-chars-or-more!!",
        FRONTEND_URL: WEB_URL,
        APP_BASE_URL: WEB_URL,
        PDF_BASE_URL: WEB_URL,
        PDF_OUTPUT_DIR: path.join(__dirname, "integration/.results/pdfs"),
        PDF_EXPORT_JWT_SECRET:
          process.env.PDF_EXPORT_JWT_SECRET ??
          "e2e-pdf-export-secret-32-chars-minimum!!",
        BULLMQ_PREFIX,
        NODE_ENV: "test",
        LOG_LEVEL: "warn", // keep test output readable
        // env.schema requires these (no defaults); the SDK stays off for e2e.
        REDIS_HOST: process.env.REDIS_HOST ?? "localhost",
        REDIS_PORT: process.env.REDIS_PORT ?? "6379",
        REDIS_MAXMEMORY_BYTES: process.env.REDIS_MAXMEMORY_BYTES ?? "209715200",
        OTEL_SDK_DISABLED: "true",
        OTEL_TRACES_SAMPLER_ARG: "0",
        HEAP_HEALTH_THRESHOLD_BYTES: "1610612736",
        // The seven optional coverage vars (TG_BOT_TOKEN, SENTRY_DSN,
        // CLIENT_LOG_FORWARDING, AUTH_DEV_MODE_ALLOW_TEST, CUSTOMREPORT_REPO_ROOT,
        // DLQ_ALERT_THRESHOLD, AUTH_JWT_COOKIE_NAME) flow through `...process.env`
        // above; no integration path depends on any of them, so none is pinned.
      },
    },
    {
      command: `pnpm --filter @customreport/web exec next dev -p ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: false,
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
        NEXT_PUBLIC_AUTH_STUB: "false",
        NODE_ENV: "test",
      },
    },
  ],
});
