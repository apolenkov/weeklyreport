import type { SeedProfile } from "../../source/contracts.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";
import type { RuntimeObservabilityConfig } from "../observability/runtime-observability-readiness.ts";
import { runtimeProfileShutdownCompletionEnvironment } from "../observability/runtime-profile-shutdown-completion.ts";
import { runtimeLaneDatabaseUrl } from "../resources/runtime-lane-database-url.ts";
import {
  type RuntimeLaneRunIdentity,
  runtimeProfileServiceName,
} from "./runtime-lane-run-identity.ts";

const RUNTIME_LANE_DB_POOL_MAX = "3";

const childBaseEnvironment = (): NodeJS.ProcessEnv => {
  const {
    RUNTIME_SWEEP_BUGSINK_API_TOKEN: _bugsinkToken,
    RUNTIME_SWEEP_LOKI_QUERY_URL: _lokiQueryUrl,
    RUNTIME_SWEEP_LOKI_PUSH_URL: _lokiPushUrl,
    RUNTIME_SWEEP_LOKI_USERNAME: _lokiUsername,
    RUNTIME_SWEEP_LOKI_PASSWORD: _lokiPassword,
    ...childEnvironment
  } = process.env;
  return childEnvironment;
};

export const runtimeLaneProfileEnvironment = (
  input: Readonly<{
    assignmentPath: string;
    assignment: RuntimeLaneAssignment;
    run: RuntimeLaneRunIdentity;
    lane: RuntimeLane;
    profile: SeedProfile;
    startedAt: string;
    baseDatabaseUrl: string;
    observability: RuntimeObservabilityConfig;
  }>,
): NodeJS.ProcessEnv => ({
  ...childBaseEnvironment(),
  E2E_API_PORT: String(input.lane.apiPort),
  E2E_WEB_PORT: String(input.lane.webPort),
  E2E_DATABASE_URL: runtimeLaneDatabaseUrl(
    input.baseDatabaseUrl,
    input.lane.databaseName,
  ),
  E2E_REDIS_FLUSH: "true",
  E2E_SEED_PROFILE: input.profile,
  REDIS_HOST: "127.0.0.1",
  REDIS_PORT: String(input.lane.redisPort),
  RUNTIME_SWEEP_API_PORT: String(input.lane.apiPort),
  RUNTIME_SWEEP_WEB_PORT: String(input.lane.webPort),
  RUNTIME_SWEEP_ARCHIVE: input.lane.archiveRoot,
  RUNTIME_SWEEP_PROFILE: input.profile,
  RUNTIME_SWEEP_SOURCE_SHA: input.assignment.sourceSha,
  RUNTIME_SWEEP_RUN_ID: input.run.runId,
  RUNTIME_SWEEP_SHUTDOWN_COMPLETION:
    runtimeProfileShutdownCompletionEnvironment(input),
  RUNTIME_SWEEP_LANE_ASSIGNMENT: input.assignmentPath,
  RUNTIME_SWEEP_LANE_ID: input.lane.laneId,
  RUNTIME_SWEEP_REUSE_DATABASE: "false",
  RUNTIME_SWEEP_BUGSINK_DSN: input.observability.bugsink.dsn,
  OTEL_EXPORTER_OTLP_ENDPOINT: input.observability.otelEndpoint,
  OTEL_SDK_DISABLED: "false",
  OTEL_SERVICE_NAME: runtimeProfileServiceName(
    input.run,
    input.lane,
    input.profile,
  ),
  OTEL_SERVICE_VERSION: input.assignment.sourceSha,
  LOG_LEVEL: "debug",
  SENTRY_DSN: input.observability.bugsink.dsn,
  NEXT_PUBLIC_SENTRY_DSN: input.observability.bugsink.dsn,
  BULLMQ_PREFIX: `customreport-runtime-${input.lane.laneId}-${input.profile}`,
  DB_POOL_MAX: RUNTIME_LANE_DB_POOL_MAX,
});
