import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import integrationConfig from "../../playwright.integration.config.ts";
import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "../../runtime-api-server-command.ts";
import { runtimeNextServerCommand } from "./run-runtime-next-server.ts";
import { runtimeSweepWebEnvironment } from "./runtime/runtime-auth-env.ts";
import { nextDistDirForNextConfig } from "./runtime/runtime-next-dist.ts";
import { runtimeTraceSamplingEnvironment } from "./runtime/runtime-observability-policy.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const canaryMode = process.env.RUNTIME_SWEEP_PREFLIGHT_MODE === "canary";
const shardMode = process.env.RUNTIME_SWEEP_PREFLIGHT_MODE === "shard";
const preflightArtifactName = shardMode
  ? "shard"
  : canaryMode
    ? "preflight-canary"
    : "preflight";
const preflightApiLogDir = shardMode
  ? path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_LOG_DIR"))
  : path.join(archiveRoot, "api-log", preflightArtifactName);
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");
const PREFLIGHT_TIMEOUT_MS = 45 * 60_000;
const PREFLIGHT_WEB_PORT = requiredEnv("E2E_WEB_PORT");
const PREFLIGHT_API_PORT = requiredEnv("E2E_API_PORT");
const PREFLIGHT_WEB_ORIGIN = `http://127.0.0.1:${PREFLIGHT_WEB_PORT}`;
const PREFLIGHT_API_ORIGIN = `http://127.0.0.1:${PREFLIGHT_API_PORT}`;
const shardPathEnvironment = shardMode
  ? {
      logDir: requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_LOG_DIR"),
      pdfDir: requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_PDF_DIR"),
      outputDir: requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_OUTPUT_DIR"),
      nextDistDir: nextDistDirForNextConfig(
        WEB_ROOT,
        requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_NEXT_DIST_DIR"),
      ),
      queuePrefix: requiredEnv("E2E_BULLMQ_PREFIX"),
      redisHost: requiredEnv("REDIS_HOST"),
      redisPort: requiredEnv("REDIS_PORT"),
      databaseUrl: requiredEnv("E2E_DATABASE_URL"),
    }
  : undefined;
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
const shardApiEnvironment =
  shardPathEnvironment === undefined
    ? {}
    : {
        DATABASE_URL: shardPathEnvironment.databaseUrl,
        PORT: PREFLIGHT_API_PORT,
        FRONTEND_URL: PREFLIGHT_WEB_ORIGIN,
        APP_BASE_URL: PREFLIGHT_WEB_ORIGIN,
        PDF_BASE_URL: PREFLIGHT_WEB_ORIGIN,
        PDF_OUTPUT_DIR: shardPathEnvironment.pdfDir,
        LOG_DIR: shardPathEnvironment.logDir,
        BULLMQ_PREFIX: shardPathEnvironment.queuePrefix,
        REDIS_HOST: shardPathEnvironment.redisHost,
        REDIS_PORT: shardPathEnvironment.redisPort,
      };
const shardWebEnvironment =
  shardPathEnvironment === undefined
    ? {}
    : {
        NEXT_PUBLIC_API_URL: PREFLIGHT_API_ORIGIN,
        NEXT_DIST_DIR: shardPathEnvironment.nextDistDir,
      };
const preflightWebEnvironment = {
  ...runtimeSweepWebEnvironment(webServer.env),
  ...shardWebEnvironment,
};
const preflightWebServerCommand = shardMode
  ? `pnpm --filter @customreport/web exec next dev -p ${PREFLIGHT_WEB_PORT}`
  : runtimeNextServerCommand("preflight", PREFLIGHT_WEB_PORT);

export default defineConfig({
  // The preflight preparation owns its exact database reset and profile seed.
  // Do not inherit the integration suite's default global reset/seed lifecycle.
  ...integrationConfigWithoutLifecycle,
  testDir: import.meta.dirname,
  testMatch: shardMode
    ? /preflight-shard\.spec\.ts/
    : canaryMode
      ? /preflight-canary\.spec\.ts/
      : /preflight\.spec\.ts/,
  outputDir:
    shardPathEnvironment?.outputDir ??
    path.join(archiveRoot, `playwright-${preflightArtifactName}`),
  use: {
    ...integrationConfigWithoutLifecycle.use,
    baseURL: PREFLIGHT_WEB_ORIGIN,
  },
  timeout: PREFLIGHT_TIMEOUT_MS,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "runtime-preflight",
      testMatch: shardMode
        ? /preflight-shard\.spec\.ts/
        : canaryMode
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
        ...shardApiEnvironment,
        ...preflightApiObservabilityEnvironment,
        LOG_DIR: preflightApiLogDir,
        LOG_LEVEL: "info",
        RUNTIME_SWEEP_API_DRAIN: "true",
      },
    },
    {
      ...webServer,
      command: preflightWebServerCommand,
      cwd: REPO_ROOT,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      env: preflightWebEnvironment,
    },
  ],
});
