import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../playwright.integration.config.ts";
import { runtimeNextServerCommand } from "./run-runtime-next-server.ts";
import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const PREFLIGHT_TIMEOUT_MS = 45 * 60_000;
const PREFLIGHT_WEB_PORT = requiredEnv("E2E_WEB_PORT");
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
      command: runtimeNextServerCommand("preflight", PREFLIGHT_WEB_PORT),
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      env: runtimeSweepWebEnvironment(webServer.env),
    },
  ],
});
