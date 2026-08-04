import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../playwright.integration.config.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const PREFLIGHT_TIMEOUT_MS = 45 * 60_000;

export default defineConfig({
  ...integrationConfig,
  testDir: import.meta.dirname,
  testMatch: /preflight\.spec\.ts/,
  outputDir: path.join(archiveRoot, "playwright-preflight"),
  timeout: PREFLIGHT_TIMEOUT_MS,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "runtime-preflight",
      testMatch: /preflight\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
