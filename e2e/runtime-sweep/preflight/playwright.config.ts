import "../../no-proxy-localhost";

import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../../playwright.integration.config.ts";
import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "../../runtime-api-server-command.ts";
import { assertSourceSha } from "../support/ids.ts";
import { runtimeNextServerCommand } from "./run-runtime-next-server.ts";
import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";
import { runtimeTraceSamplingEnvironment } from "./runtime-observability-policy.ts";

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
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const API_LOG_DIR = path.join(ARCHIVE_ROOT, "api-log", PROFILE);
const PDF_OUTPUT_DIR = path.join(ARCHIVE_ROOT, "pdfs", PROFILE);

const webServers = integrationConfig.webServer;
if (!Array.isArray(webServers) || webServers.length !== 2) {
  throw new Error("Runtime sweep requires the integration API and web servers");
}
const [apiServer, webServer] = webServers;
if (!apiServer || !webServer) {
  throw new Error("Runtime sweep server configuration is incomplete");
}

const {
  SMTP_HOST: _smtpHost,
  SMTP_PORT: _smtpPort,
  SMTP_USER: _smtpUser,
  SMTP_PASS: _smtpPass,
  SMTP_FROM: _smtpFrom,
  ...nonSmtpApiEnv
} = apiServer.env ?? {};

const apiEnv = {
  ...nonSmtpApiEnv,
  DATABASE_URL,
  PORT: String(API_PORT),
  FRONTEND_URL: WEB_URL,
  APP_BASE_URL: WEB_URL,
  PDF_BASE_URL: WEB_URL,
  LOG_DIR: API_LOG_DIR,
  LOG_LEVEL: requiredEnv("LOG_LEVEL"),
  PDF_OUTPUT_DIR,
  OTEL_EXPORTER_OTLP_ENDPOINT: requiredEnv("OTEL_EXPORTER_OTLP_ENDPOINT"),
  OTEL_SDK_DISABLED: "false",
  OTEL_SERVICE_NAME: requiredEnv("OTEL_SERVICE_NAME"),
  OTEL_SERVICE_VERSION: requiredEnv("OTEL_SERVICE_VERSION"),
  ...runtimeTraceSamplingEnvironment,
  SENTRY_DSN: requiredEnv("RUNTIME_SWEEP_BUGSINK_DSN"),
  RUNTIME_SWEEP_API_DRAIN: "true",
};
const webEnv = {
  ...runtimeSweepWebEnvironment(webServer.env),
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
  NEXT_PUBLIC_SENTRY_DSN: requiredEnv("RUNTIME_SWEEP_BUGSINK_DSN"),
};

export default defineConfig({
  testDir: path.resolve(import.meta.dirname, ".."),
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
      command: runtimeApiServerCommand,
      cwd: runtimeApiServerCwd,
      url: `http://127.0.0.1:${API_PORT}/health/ready`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
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
