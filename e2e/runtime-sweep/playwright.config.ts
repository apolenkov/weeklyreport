import "../no-proxy-localhost";

import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../playwright.integration.config.ts";
import { assertSourceSha } from "./ids.ts";
import { runtimeNextServerCommand } from "./run-runtime-next-server.ts";
import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime sweep requires ${name}`);
  return value;
};

const ARCHIVE_ROOT = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const SOURCE_SHA = requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
assertSourceSha(SOURCE_SHA);
const PROFILE = requiredEnv("RUNTIME_SWEEP_PROFILE");
const DATABASE_URL = requiredEnv("E2E_DATABASE_URL");
const API_PORT = Number(process.env.RUNTIME_SWEEP_API_PORT ?? "3102");
const WEB_PORT = Number(process.env.RUNTIME_SWEEP_WEB_PORT ?? "3105");
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
process.env.RUNTIME_SWEEP_BASE_URL = WEB_URL;
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

const webServers = integrationConfig.webServer;
if (!Array.isArray(webServers) || webServers.length !== 2) {
  throw new Error("Runtime sweep requires the integration API and web servers");
}
const [apiServer, webServer] = webServers;
if (!apiServer || !webServer) {
  throw new Error("Runtime sweep server configuration is incomplete");
}

const apiEnv = {
  ...apiServer.env,
  DATABASE_URL,
  PORT: String(API_PORT),
  FRONTEND_URL: WEB_URL,
  APP_BASE_URL: WEB_URL,
  PDF_BASE_URL: WEB_URL,
};
const webEnv = {
  ...runtimeSweepWebEnvironment(webServer.env),
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
};

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch:
    /(?:concurrency|fault-recovery|runtime-matrix|runtime-sweep|z-runtime-sweep-live-lane)\.spec\.ts/,
  outputDir: path.join(ARCHIVE_ROOT, "playwright", PROFILE),
  globalSetup: path.join(REPO_ROOT, "e2e/integration/global-setup.ts"),
  globalTeardown: path.join(REPO_ROOT, "e2e/integration/global-teardown.ts"),
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: path.join(
          ARCHIVE_ROOT,
          `playwright-results-${PROFILE}.json`,
        ),
      },
    ],
  ],
  use: {
    baseURL: WEB_URL,
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "runtime-prerequisites",
      testMatch: /(?:concurrency|fault-recovery)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "runtime-baseline",
      testMatch: /runtime-sweep\.spec\.ts/,
      dependencies: ["runtime-prerequisites"],
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "runtime-matrix",
      testMatch: /runtime-matrix\.spec\.ts/,
      dependencies: ["runtime-baseline"],
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "runtime-live-controls",
      testMatch: /z-runtime-sweep-live-lane\.spec\.ts/,
      dependencies: ["runtime-matrix"],
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      ...apiServer,
      command: "pnpm --filter @customreport/api dev",
      url: `http://127.0.0.1:${API_PORT}/health/ready`,
      reuseExistingServer: false,
      env: apiEnv,
    },
    {
      ...webServer,
      command: runtimeNextServerCommand("sweep", WEB_PORT),
      cwd: REPO_ROOT,
      url: WEB_URL,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      env: webEnv,
    },
  ],
});
