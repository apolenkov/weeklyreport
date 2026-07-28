// Side-effect import: ensure loopback health probes bypass any corporate proxy
// (see e2e/no-proxy-localhost.ts) before the webServer probes run.
import "../no-proxy-localhost";

import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Drives the durable Scenario Catalog per role and records console/a11y
// anomalies without blocking CI, as required by the durable sweep spec.
// See openspec/specs/behavioral-ui-regression-gate/spec.md.

const WEB_PORT = Number(process.env.SWEEP_WEB_PORT ?? 3100);
const API_PORT = Number(process.env.SWEEP_API_PORT ?? 3101);
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

// Repo root (e2e/sweep/playwright.config.ts → ../..).
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

export default defineConfig({
  testDir: ".",
  testIgnore: ["**/integration/**"],
  outputDir: ".results",
  // A route walk that logs in, navigates, and runs axe is slower than a unit
  // test; give each sweep step room before it is flagged as a hang.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  // Sequential: dev-login is rate-limited and the sweep shares one seeded DB.
  // The sweep is a report, not a perf-sensitive suite — determinism > speed.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [["github"], ["json", { outputFile: ".results/results.json" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Belongs under contextOptions, not beside it: as a bare `use` key it is
    // not a test option and Playwright silently ran with animations on.
    contextOptions: { reducedMotion: "reduce" },
  },

  projects: [
    {
      name: "sweep",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /catalog-sweep\.spec\.ts/,
    },
  ],

  // The sweep spawns BOTH the API (NestJS) and the web app (Next.js) in
  // dev-auth mode, mirroring the old e2e harness. Ports are distinct from the
  // integration suite (3102/3105) so the two can coexist.
  webServer: [
    {
      // @swc-node/register, not tsx: esbuild does not implement
      // emitDecoratorMetadata, so Nest cannot resolve type-injected providers
      // and the api never finishes booting.
      command: `node --env-file=${REPO_ROOT}/.env --import @swc-node/register/esm-register src/main.ts`,
      cwd: path.join(REPO_ROOT, "apps", "api"),
      url: `${API_URL}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        AUTH_DEV_MODE: "true",
        NODE_ENV: "test",
        FRONTEND_URL: WEB_URL,
        LOG_DIR: ".logs/sweep",
      },
    },
    {
      command: `pnpm --filter @customreport/web exec next dev -p ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
        AUTH_DEV_MODE: "true",
        NODE_ENV: "test",
        NEXT_PUBLIC_AUTH_STUB: "true",
        // `next dev` forces NODE_ENV=development, which would mount the
        // Agentation dev-tools widget (console + a11y + :4747 network noise that
        // is not part of the product under test). Disable it for the sweep.
        NEXT_PUBLIC_DISABLE_DEVTOOLS: "true",
        // Isolate the build dir so the sweep web server coexists with a
        // running `pnpm dev` Next instance (N16 fingerprints by repo dir +
        // .next).
        NEXT_DIST_DIR: ".next-sweep",
      },
    },
  ],
});
