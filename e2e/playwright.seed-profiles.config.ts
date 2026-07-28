import path from "node:path";

import { defineConfig } from "@playwright/test";

import integrationConfig from "./playwright.integration.config";

const chromium = integrationConfig.projects?.[0];
if (!chromium) throw new Error("Integration Chromium project is missing");

export default defineConfig({
  ...integrationConfig,
  testDir: path.join(import.meta.dirname, "seed-profiles"),
  testMatch: "**/*.spec.ts",
  outputDir: path.join(import.meta.dirname, "seed-profiles/.results"),
  globalSetup: path.join(import.meta.dirname, "seed-profiles/global-setup.ts"),
  projects: [{ ...chromium, name: "chromium-seed-profiles" }],
});
