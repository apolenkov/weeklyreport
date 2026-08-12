import { writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  type BugsinkProbeConfig,
  probeBugsinkAt,
} from "../../preflight/observability/environment-observer-bugsink.ts";
import { normalizeBugsinkDsn } from "../../preflight/observability/environment-observer-bugsink-client.ts";
import { probeBugsinkSdkAt } from "../../preflight/observability/environment-observer-bugsink-sdk.ts";
import {
  type LokiProbeConfig,
  probeLokiAt,
} from "../../preflight/observability/environment-observer-probes.ts";
import { sha256DigestSchema, sourceShaSchema } from "../../source/contracts.ts";
import type { RuntimeLaneAssignment } from "../contracts/runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "../profiles/runtime-lane-run-identity.ts";

const PROBE_TIMEOUT_MS = 5000;

export interface RuntimeObservabilityConfig {
  readonly otelEndpoint: string;
  readonly bugsink: BugsinkProbeConfig;
  readonly loki: LokiProbeConfig;
}

export interface RuntimeObservabilityReadiness {
  readonly checkedAt: string;
  readonly otel: "live";
  readonly bugsink: "live";
  readonly bugsinkProtocol: "live";
  readonly bugsinkSdk: "live";
  readonly bugsinkApiSdk: "live";
  readonly bugsinkBrowserSdk: "live";
  readonly loki: "live";
}

export const runtimeObservabilityReadinessReportSchema = z
  .object({
    artifact: z.literal("RUNTIME_OBSERVABILITY_READINESS"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    runId: z.uuid(),
    laneId: z.string().min(1),
    checkedAt: z.iso.datetime(),
    otel: z.literal("live"),
    bugsink: z.literal("live"),
    bugsinkProtocol: z.literal("live"),
    bugsinkSdk: z.literal("live"),
    bugsinkApiSdk: z.literal("live"),
    bugsinkBrowserSdk: z.literal("live"),
    loki: z.literal("live"),
  })
  .strict();

const requiredEnv = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Runtime observability requires ${name}`);
  return value;
};

const httpUrl = (value: string, name: string): string => {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new Error(`Runtime observability ${name} must use HTTP(S)`);
  return parsed.toString();
};

export function readRuntimeObservabilityConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeObservabilityConfig {
  const username = env.RUNTIME_SWEEP_LOKI_USERNAME?.trim();
  const password = env.RUNTIME_SWEEP_LOKI_PASSWORD;
  if ((username === undefined) !== (password === undefined))
    throw new Error(
      "Runtime observability Loki username and password must be supplied together",
    );
  const lokiCredentials =
    username === undefined || password === undefined
      ? {}
      : { username, password };
  return {
    otelEndpoint: httpUrl(
      requiredEnv(env, "OTEL_EXPORTER_OTLP_ENDPOINT"),
      "OTEL endpoint",
    ),
    bugsink: {
      dsn: normalizeBugsinkDsn(
        httpUrl(requiredEnv(env, "RUNTIME_SWEEP_BUGSINK_DSN"), "Bugsink DSN"),
      ),
      apiToken: requiredEnv(env, "RUNTIME_SWEEP_BUGSINK_API_TOKEN"),
    },
    loki: {
      pushUrl: httpUrl(
        requiredEnv(env, "RUNTIME_SWEEP_LOKI_PUSH_URL"),
        "Loki push URL",
      ),
      queryUrl: httpUrl(
        requiredEnv(env, "RUNTIME_SWEEP_LOKI_QUERY_URL"),
        "Loki query URL",
      ),
      ...lokiCredentials,
    },
  };
}

const assertOtel = async (
  endpoint: string,
  fetcher: typeof fetch,
): Promise<void> => {
  const response = await fetcher(`${endpoint.replace(/\/$/u, "")}/v1/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceLogs: [] }),
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`Runtime observability OTel rejected the probe`);
};

export async function assertRuntimeObservabilityReadiness(
  config: RuntimeObservabilityConfig,
  fetcher: typeof fetch = fetch,
): Promise<RuntimeObservabilityReadiness> {
  const probeTime = Date.now();
  const bugsink = await probeBugsinkAt(config.bugsink, probeTime, fetcher);
  if (!bugsink.reachable || !bugsink.hasStreams)
    throw new Error(
      "Runtime observability Bugsink protocol probe was not stored",
    );
  const [sdkBugsink, loki] = await Promise.all([
    probeBugsinkSdkAt(config.bugsink, fetcher),
    probeLokiAt(config.loki, probeTime, fetcher),
  ]);
  await assertOtel(config.otelEndpoint, fetcher);
  if (!sdkBugsink)
    throw new Error("Runtime observability Bugsink SDK probe was not stored");
  if (!loki.reachable || !loki.hasStreams)
    throw new Error("Runtime observability Loki probe was not queryable");
  return {
    checkedAt: new Date(probeTime).toISOString(),
    otel: "live",
    bugsink: "live",
    bugsinkProtocol: "live",
    bugsinkSdk: "live",
    bugsinkApiSdk: "live",
    bugsinkBrowserSdk: "live",
    loki: "live",
  };
}

export const writeRuntimeObservabilityReadiness = async (
  assignment: RuntimeLaneAssignment,
  run: RuntimeLaneRunIdentity,
  readiness: RuntimeObservabilityReadiness,
): Promise<void> => {
  await Promise.all(
    assignment.lanes.map((lane) => {
      const report = runtimeObservabilityReadinessReportSchema.parse({
        artifact: "RUNTIME_OBSERVABILITY_READINESS",
        version: 1,
        sourceSha: assignment.sourceSha,
        matrixDigest: assignment.matrixDigest,
        assignmentDigest: assignment.assignmentDigest,
        runId: run.runId,
        laneId: lane.laneId,
        ...readiness,
      });
      return writeFile(
        path.join(lane.archiveRoot, "OBSERVABILITY-READINESS.json"),
        `${JSON.stringify(report, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
    }),
  );
};
