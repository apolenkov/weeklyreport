import * as path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { assertE2eRuntimeDestructiveTarget } from "../../../prisma/guards/_destructive-guard.ts";
import integrationConfig from "../../playwright.integration.config.ts";
import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "../../runtime-api-server-command.ts";
import { assertRuntimeSourceAuthorityFromEnvironment } from "../source/runtime-source-authority.ts";
import { runtimeNextServerCommand } from "./run-runtime-next-server.ts";
import {
  assertPersistentServerLeaseIdentity,
  persistentServerLeaseEnvironmentState,
  PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ENV,
  readPersistentServerLease,
} from "./runtime/preflight-persistent-server-lease.ts";
import { runtimeSweepWebEnvironment } from "./runtime/runtime-auth-env.ts";
import { nextDistDirForNextConfig } from "./runtime/runtime-next-dist.ts";
import { runtimeTraceSamplingEnvironment } from "./runtime/runtime-observability-policy.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const sourceAuthority = await assertRuntimeSourceAuthorityFromEnvironment();
const archiveRoot = path.resolve(requiredEnv("RUNTIME_SWEEP_ARCHIVE"));
const preflightDatabaseUrl = requiredEnv("E2E_DATABASE_URL");
assertE2eRuntimeDestructiveTarget(
  "runtime-preflight-playwright-config",
  preflightDatabaseUrl,
  process.env,
);
const canaryMode = process.env.RUNTIME_SWEEP_PREFLIGHT_MODE === "canary";
const persistentServerLeaseEnvironment = persistentServerLeaseEnvironmentState(
  process.env,
);
const hasPersistentServerLease = persistentServerLeaseEnvironment !== undefined;
if (hasPersistentServerLease && !canaryMode)
  throw new Error(
    "Persistent preflight server lease is allowed only in canary mode",
  );
if (hasPersistentServerLease) {
  const childAttemptId = requiredEnv(PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ENV);
  const leaseRelative = path.relative(
    archiveRoot,
    persistentServerLeaseEnvironment.path,
  );
  if (
    leaseRelative === "" ||
    leaseRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(leaseRelative)
  )
    throw new Error(
      "Persistent preflight server lease must be inside the archive root",
    );
  if (
    persistentServerLeaseEnvironment.campaignId !==
      sourceAuthority.source.campaignId ||
    persistentServerLeaseEnvironment.sourceTree !==
      sourceAuthority.source.sourceTree
  )
    throw new Error(
      "Persistent preflight server lease environment is not source-bound",
    );
  if (persistentServerLeaseEnvironment.attemptId !== childAttemptId)
    throw new Error(
      "Persistent preflight server lease environment is not bound to this continuation child",
    );
  const leaseFile = await readPersistentServerLease({
    path: persistentServerLeaseEnvironment.path,
    digest: persistentServerLeaseEnvironment.digest,
  });
  assertPersistentServerLeaseIdentity(leaseFile.lease, {
    campaignId: sourceAuthority.source.campaignId,
    attemptId: childAttemptId,
    sourceSha: sourceAuthority.source.sourceSha,
    sourceTree: sourceAuthority.source.sourceTree,
    apiPort: Number(requiredEnv("E2E_API_PORT")),
    webPort: Number(requiredEnv("E2E_WEB_PORT")),
  });
}
const shardMode = process.env.RUNTIME_SWEEP_PREFLIGHT_MODE === "shard";
const capacitySurveyMode =
  process.env.RUNTIME_SWEEP_PREFLIGHT_MODE === "capacity-survey";
const capacitySurveyTempRootValue = capacitySurveyMode
  ? requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_TEMP_ROOT")
  : undefined;
const capacitySurveyTempRoot =
  capacitySurveyTempRootValue === undefined
    ? undefined
    : path.resolve(capacitySurveyTempRootValue);
if (
  capacitySurveyTempRootValue !== undefined &&
  (!path.isAbsolute(capacitySurveyTempRootValue) ||
    capacitySurveyTempRoot !== capacitySurveyTempRootValue)
)
  throw new Error(
    "Capacity survey temp root must be a normalized absolute path",
  );
const preflightArtifactName = shardMode
  ? "shard"
  : canaryMode
    ? "preflight-canary"
    : capacitySurveyMode
      ? "capacity-survey"
      : "preflight";
const preflightApiLogDir =
  capacitySurveyTempRoot === undefined
    ? shardMode
      ? path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT_SHARD_LOG_DIR"))
      : path.join(archiveRoot, "api-log", preflightArtifactName)
    : path.join(capacitySurveyTempRoot, "api-log");
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");
const DEFAULT_PREFLIGHT_TIMEOUT_MS = 45 * 60_000;
const configuredCapacitySurveyTimeout = capacitySurveyMode
  ? Number(requiredEnv("RUNTIME_SWEEP_CAPACITY_SURVEY_MAX_DURATION_MS"))
  : undefined;
if (
  configuredCapacitySurveyTimeout !== undefined &&
  (!Number.isSafeInteger(configuredCapacitySurveyTimeout) ||
    configuredCapacitySurveyTimeout < 1)
)
  throw new Error("Capacity survey requires a positive max duration");
const PREFLIGHT_TIMEOUT_MS =
  configuredCapacitySurveyTimeout ?? DEFAULT_PREFLIGHT_TIMEOUT_MS;
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
const preflightOutputDir =
  capacitySurveyTempRoot === undefined
    ? (shardPathEnvironment?.outputDir ??
      path.join(archiveRoot, `playwright-${preflightArtifactName}`))
    : path.join(capacitySurveyTempRoot, "playwright");
const preflightSpec = shardMode
  ? /preflight-shard\.spec\.ts/
  : canaryMode
    ? /preflight-canary\.spec\.ts/
    : capacitySurveyMode
      ? /preflight-capacity-survey\.spec\.ts/
      : /preflight\.spec\.ts/;
const preflightContextOptions = capacitySurveyMode
  ? { ...integrationConfigWithoutLifecycle.use?.contextOptions }
  : {
      ...integrationConfigWithoutLifecycle.use?.contextOptions,
      recordHar: {
        path: path.join(preflightOutputDir, "network.har"),
        content: "omit" as const,
        mode: "full" as const,
      },
    };

export default defineConfig({
  // The preflight preparation owns its exact database reset and profile seed.
  // Do not inherit the integration suite's default global reset/seed lifecycle.
  ...integrationConfigWithoutLifecycle,
  testDir: import.meta.dirname,
  testMatch: preflightSpec,
  outputDir: preflightOutputDir,
  ...(capacitySurveyMode ? { reporter: [["list"]] as const, retries: 0 } : {}),
  use: {
    ...integrationConfigWithoutLifecycle.use,
    baseURL: PREFLIGHT_WEB_ORIGIN,
    contextOptions: preflightContextOptions,
    ...(capacitySurveyMode
      ? {
          trace: "off" as const,
          screenshot: "off" as const,
          video: "off" as const,
        }
      : {
          trace: {
            mode: "retain-on-failure" as const,
            snapshots: false,
            screenshots: false,
            sources: true,
            attachments: true,
          },
        }),
  },
  timeout: PREFLIGHT_TIMEOUT_MS,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "runtime-preflight",
      testMatch: preflightSpec,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: hasPersistentServerLease
    ? []
    : [
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
