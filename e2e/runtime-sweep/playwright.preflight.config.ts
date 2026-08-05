import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../playwright.integration.config.ts";
import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";
import { RUNTIME_NEXT_DIST } from "./runtime-next-dist.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const PREFLIGHT_TIMEOUT_MS = 45 * 60_000;
const integrationServers = integrationConfig.webServer;
if (!Array.isArray(integrationServers) || integrationServers.length !== 2) {
  throw new Error("Runtime preflight requires the integration web servers");
}
const [apiServer, webServer] = integrationServers;
if (!apiServer || !webServer) {
  throw new Error("Runtime preflight server configuration is incomplete");
}

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
  webServer: [
    apiServer,
    {
      ...webServer,
      command: `pnpm exec tsx e2e/runtime-sweep/prepare-runtime-next-dist.ts ${RUNTIME_NEXT_DIST.preflight} && ${webServer.command}`,
      env: runtimeSweepWebEnvironment(
        webServer.env,
        RUNTIME_NEXT_DIST.preflight,
      ),
    },
  ],
});
