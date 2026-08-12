import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../../playwright.integration.config.ts";
import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "../../runtime-api-server-command.ts";
import { runtimeNextServerCommand } from "./run-runtime-next-server.ts";
import { runtimeSweepWebEnvironment } from "./runtime-auth-env.ts";
import { runtimeTraceSamplingEnvironment } from "./runtime-observability-policy.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const canaryMode = process.env.RUNTIME_SWEEP_PREFLIGHT_MODE === "canary";
const preflightArtifactName = canaryMode ? "preflight-canary" : "preflight";
const preflightApiLogDir = path.join(
  archiveRoot,
  "api-log",
  preflightArtifactName,
);
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const PREFLIGHT_TIMEOUT_MS = 45 * 60_000;
const PREFLIGHT_WEB_PORT = requiredEnv("E2E_WEB_PORT");
const {
  globalSetup: _integrationGlobalSetup,
  globalTeardown: _integrationGlobalTeardown,
  ...integrationConfigWithoutLifecycle
} = integrationConfig;
const integrationServers = integrationConfigWithoutLifecycle.webServer;
if (!Array.isArray(integrationServers) || integrationServers.length !== 2) {
  throw new Error("Runtime preflight requires the integration web servers");
}
const [apiServer, webServer] = integrationServers;
if (!apiServer || !webServer) {
  throw new Error("Runtime preflight server configuration is incomplete");
}
const preflightApiObservabilityEnvironment = {
  OTEL_EXPORTER_OTLP_ENDPOINT: requiredEnv("OTEL_EXPORTER_OTLP_ENDPOINT"),
  OTEL_SDK_DISABLED: "false",
  OTEL_SERVICE_NAME: requiredEnv("OTEL_SERVICE_NAME"),
  OTEL_SERVICE_VERSION: requiredEnv("OTEL_SERVICE_VERSION"),
  ...runtimeTraceSamplingEnvironment,
} as const;

export default defineConfig({
  // The preflight preparation owns its exact database reset and profile seed.
  // Do not inherit the integration suite's default global reset/seed lifecycle.
  ...integrationConfigWithoutLifecycle,
  testDir: import.meta.dirname,
  testMatch: canaryMode ? /preflight-canary\.spec\.ts/ : /preflight\.spec\.ts/,
  outputDir: path.join(archiveRoot, `playwright-${preflightArtifactName}`),
  timeout: PREFLIGHT_TIMEOUT_MS,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "runtime-preflight",
      testMatch: canaryMode
        ? /preflight-canary\.spec\.ts/
        : /preflight\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      ...apiServer,
      command: runtimeApiServerCommand,
      cwd: runtimeApiServerCwd,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      env: {
        ...apiServer.env,
        ...preflightApiObservabilityEnvironment,
        LOG_DIR: preflightApiLogDir,
        LOG_LEVEL: "info",
        RUNTIME_SWEEP_API_DRAIN: "true",
      },
    },
    {
      ...webServer,
      command: runtimeNextServerCommand("preflight", PREFLIGHT_WEB_PORT),
      cwd: REPO_ROOT,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      env: runtimeSweepWebEnvironment(webServer.env),
    },
  ],
});
