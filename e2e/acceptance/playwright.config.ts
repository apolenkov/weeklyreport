import "../no-proxy-localhost.js";

import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "../runtime-api-server-command.ts";
import { acceptanceEnvironmentFor } from "./config-environment.ts";

const target = acceptanceEnvironmentFor(process.env);
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const resultsRoot = path.join(import.meta.dirname, ".results");
const webDistDir = path.join(repoRoot, "apps", "web", ".next-acceptance");
const queuePrefix = `weeklyreport-acceptance-${process.pid}-${Date.now()}`;
const commandKind =
  process.env.ACCEPTANCE_COMMAND_KIND === "smoke" ||
  process.env.ACCEPTANCE_COMMAND_KIND === "route-health"
    ? process.env.ACCEPTANCE_COMMAND_KIND
    : "combined";

process.env.E2E_API_PORT = String(target.apiPort);
process.env.E2E_WEB_PORT = String(target.webPort);
process.env.NEXT_PUBLIC_API_URL = target.apiUrl;

export default defineConfig({
  testDir: import.meta.dirname,
  testIgnore: "**/*.test.ts",
  outputDir: path.join(resultsRoot, "artifacts"),
  globalSetup: path.join(import.meta.dirname, "global-setup.ts"),
  globalTeardown: path.join(import.meta.dirname, "global-teardown.ts"),
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [
        ["github"],
        [
          "html",
          { open: "never", outputFolder: path.join(resultsRoot, "html") },
        ],
        ["json", { outputFile: path.join(resultsRoot, "results.json") }],
        [
          "./acceptance-reporter.ts",
          {
            apiPort: target.apiPort,
            commandKind,
            repoRoot,
            resultsRoot,
            webPort: target.webPort,
            webDistDir,
          },
        ],
      ]
    : [
        ["list"],
        [
          "html",
          { open: "never", outputFolder: path.join(resultsRoot, "html") },
        ],
        ["json", { outputFile: path.join(resultsRoot, "results.json") }],
        [
          "./acceptance-reporter.ts",
          {
            apiPort: target.apiPort,
            commandKind,
            repoRoot,
            resultsRoot,
            webPort: target.webPort,
            webDistDir,
          },
        ],
      ],
  use: {
    baseURL: target.webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    {
      name: "route-health",
      testMatch: "route-health.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "smoke-lifecycle",
      testMatch: "smoke-lifecycle.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: runtimeApiServerCommand,
      cwd: runtimeApiServerCwd,
      url: `${target.apiUrl}/health/ready`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...process.env,
        PORT: String(target.apiPort),
        DATABASE_URL: target.databaseUrl,
        AUTH_DEV_MODE: "true",
        AUTH_JWT_SECRET: "acceptance-secret-must-be-32-chars!!",
        FRONTEND_URL: target.webUrl,
        APP_BASE_URL: target.webUrl,
        PDF_BASE_URL: target.webUrl,
        PDF_OUTPUT_DIR: path.join(resultsRoot, "pdfs"),
        PDF_EXPORT_JWT_SECRET: "acceptance-pdf-export-secret-32-chars!!",
        BULLMQ_PREFIX: queuePrefix,
        NODE_ENV: "test",
        LOG_DIR: path.join(resultsRoot, "logs"),
        LOG_LEVEL: "warn",
        REDIS_HOST: process.env.REDIS_HOST ?? "127.0.0.1",
        REDIS_PORT: process.env.REDIS_PORT ?? "6379",
        REDIS_MAXMEMORY_BYTES: process.env.REDIS_MAXMEMORY_BYTES ?? "209715200",
        OTEL_SDK_DISABLED: "true",
        OTEL_TRACES_SAMPLER_ARG: "0",
        HEAP_HEALTH_THRESHOLD_BYTES: "1610612736",
      },
    },
    {
      command: `pnpm --filter @customreport/web exec next dev --webpack -p ${target.webPort}`,
      cwd: repoRoot,
      url: target.webUrl,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: target.apiUrl,
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_DISABLE_DEVTOOLS: "true",
        NEXT_DIST_DIR: ".next-acceptance",
        NODE_ENV: "test",
      },
    },
  ],
});
