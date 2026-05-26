import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3101);
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

// Repo root (e2e/playwright.config.ts → ..).
const REPO_ROOT = path.resolve(__dirname, "..");

export default defineConfig({
  testDir: ".",
  testIgnore: ["**/integration/**"],
  outputDir: ".results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["json", { outputFile: ".results/results.json" }]]
    : "html",
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },

  projects: [
    // Auth setup -- writes storage state files from real /auth/dev-login.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // Journey tests run after setup.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /integration[\\/]/, /visual[\\/]/],
    },

    // Phase 39-06: visual regression baselines. Locked viewport + locale +
    // colour scheme + low pixel-diff threshold so any genuine UI change
    // surfaces immediately. Determinism is enforced inside each spec via
    // page.clock.install (frozen time) and AI_VISUAL_STUB on the API.
    //
    // Snapshot dir is OS-pinned by Playwright (foo.spec.ts-snapshots/<name>-<project>-<platform>.png)
    // so darwin baselines are stored separately from linux baselines. CI
    // generates its own linux-pinned set on first run via --update-snapshots.
    {
      name: "visual",
      testDir: "visual",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        locale: "ru-RU",
        colorScheme: "light",
        timezoneId: "UTC",
      },
      expect: {
        toHaveScreenshot: {
          // 0.1% pixel-ratio threshold + 100px slop covers font hinting and
          // 1-pixel anti-aliasing without masking real regressions.
          maxDiffPixelRatio: 0.001,
          maxDiffPixels: 100,
          threshold: 0.1,
          animations: "disabled",
          caret: "hide",
        },
      },
    },
  ],

  // E2E spawns BOTH the API (NestJS on API_PORT) and the web app
  // (Next.js on WEB_PORT). The web server reads NEXT_PUBLIC_API_URL
  // at build time but in dev mode tRPC calls are proxied via the same
  // origin, so we just point the API to API_PORT and the web to it.
  webServer: [
    {
      command: `node --env-file=${REPO_ROOT}/.env --import @swc-node/register/esm-register src/main.ts`,
      cwd: path.join(REPO_ROOT, "apps", "api"),
      url: `${API_URL}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        AUTH_DEV_MODE: "true",
        NODE_ENV: "test",
        FRONTEND_URL: WEB_URL,
        LOG_DIR: ".logs/e2e",
        // Phase 39-06: stub Anthropic so the AI summary card renders a
        // frozen narrative — without this the screenshot diff would catch
        // every probabilistic re-roll from Haiku as a regression.
        AI_VISUAL_STUB: "true",
      },
    },
    {
      command: `pnpm --filter @customreport/web exec next dev -p ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
        AUTH_DEV_MODE: "true",
        NODE_ENV: "test",
        // Phase 39-06: enables the dev-login picker on the landing page so
        // the "logged-out landing" baseline captures the picker grid (the
        // SSO-only fallback would be a near-empty card).
        NEXT_PUBLIC_AUTH_STUB: "true",
        // Distinct distDir lets the E2E web server coexist with the
        // user's `pnpm dev` Next instance — N16 fingerprints the dev
        // process by repo dir + .next, so isolating .next is enough.
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
