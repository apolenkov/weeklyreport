import { mkdir, mkdtemp, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { RuntimeLaneAssignment } from "../contracts/runtime-lane-contract.ts";
import {
  type RuntimeLaneRunIdentity,
  writeRuntimeLaneRunIdentity,
} from "../profiles/runtime-lane-run-identity.ts";
import { writeRuntimeLaneObservabilityManifest } from "./runtime-lane-observability-manifest.ts";

const SOURCE_SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;
const NO_CONTEXT = "no-context";
export const SOURCE_SHA = "a".repeat(SOURCE_SHA_LENGTH);
const ASSIGNMENT_DIGEST = "b".repeat(DIGEST_LENGTH);
const MATRIX_DIGEST = "c".repeat(DIGEST_LENGTH);
export const RUN_ID = "00000000-0000-4000-8000-000000000001";
const STARTED_AT = "2026-08-07T00:00:00.000Z";
const ENDED_AT = "2026-08-07T00:01:00.000Z";
const SHUTDOWN_MESSAGE = "API shutdown log barrier reached";
const OBSERVABILITY_CONFIG = {
  otelEndpoint: "http://127.0.0.1:4318/",
  bugsink: {
    dsn: "http://key@127.0.0.1:8000/1",
    apiToken: "a".repeat(SOURCE_SHA_LENGTH),
  },
  loki: {
    pushUrl: "http://127.0.0.1:3100/loki/api/v1/push",
    queryUrl: "http://127.0.0.1:3100/loki/api/v1/query_range",
  },
} as const;
const CLEAN_COUNTS = [
  { correlationId: "corr-a", level: "info", count: 1 },
  { correlationId: NO_CONTEXT, level: "info", count: 1 },
] as const;

type FetchRequest = string | URL | Request;

const requestUrl = (request: FetchRequest): string =>
  typeof request === "string"
    ? request
    : request instanceof URL
      ? request.toString()
      : request.url;

const lokiResponse = (
  counts: typeof CLEAN_COUNTS | readonly [],
  shutdownMarkers: number,
  request: FetchRequest,
): Response => {
  const query = new URL(requestUrl(request)).searchParams.get("query") ?? "";
  const result = query.includes(SHUTDOWN_MESSAGE)
    ? [{ metric: {}, value: [0, String(shutdownMarkers)] }]
    : counts.map(({ correlationId, level, count }) => ({
        metric: { correlationId, level },
        value: [0, String(count)],
      }));
  return new Response(
    JSON.stringify({
      status: "success",
      data: { resultType: "vector", result },
    }),
    { status: 200 },
  );
};

export const verificationDependencies = (
  counts: typeof CLEAN_COUNTS | readonly [] = CLEAN_COUNTS,
  shutdownMarkers = 1,
) => ({
  observability: OBSERVABILITY_CONFIG,
  fetcher: (request: FetchRequest) =>
    Promise.resolve(lokiResponse(counts, shutdownMarkers, request)),
});

export const assignmentFor = (root: string): RuntimeLaneAssignment => ({
  artifact: "RUNTIME_LANE_ASSIGNMENT",
  version: 1,
  sourceSha: SOURCE_SHA,
  matrixDigest: MATRIX_DIGEST,
  mode: "one-cell",
  sourceArchiveRoot: root,
  sourceArtifacts: {
    SOURCE: "d".repeat(DIGEST_LENGTH),
    SOURCE_VALIDATION: "1".repeat(DIGEST_LENGTH),
    PREFLIGHT: "e".repeat(DIGEST_LENGTH),
    MATRIX: "f".repeat(DIGEST_LENGTH),
    MANIFEST: "0".repeat(DIGEST_LENGTH),
  },
  profiles: ["minimal"],
  lanes: [
    {
      laneId: "a",
      databaseName: "customreport_e2e_lane_a_test",
      redisPort: 6381,
      apiPort: 3112,
      webPort: 3115,
      archiveRoot: path.join(root, "lanes", "a"),
      groups: [{ profile: "minimal", caseIds: ["case-a"] }],
    },
  ],
  assignmentDigest: ASSIGNMENT_DIGEST,
});

const runFor = (assignment: RuntimeLaneAssignment): RuntimeLaneRunIdentity => ({
  artifact: "RUNTIME_LANE_RUN",
  version: 1,
  sourceSha: assignment.sourceSha,
  matrixDigest: assignment.matrixDigest,
  assignmentDigest: assignment.assignmentDigest,
  runId: RUN_ID,
  startedAt: STARTED_AT,
  laneIds: ["a"],
  profiles: ["minimal"],
});

export const writeJson = (filePath: string, value: unknown): Promise<void> =>
  writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");

const readiness = (assignment: RuntimeLaneAssignment) => ({
  artifact: "RUNTIME_OBSERVABILITY_READINESS",
  version: 1,
  sourceSha: assignment.sourceSha,
  matrixDigest: assignment.matrixDigest,
  assignmentDigest: assignment.assignmentDigest,
  runId: RUN_ID,
  laneId: "a",
  checkedAt: STARTED_AT,
  otel: "live",
  bugsink: "live",
  bugsinkProtocol: "live",
  bugsinkSdk: "live",
  bugsinkApiSdk: "live",
  bugsinkBrowserSdk: "live",
  loki: "live",
});

export const profile = (
  assignment: RuntimeLaneAssignment,
  status: "pass" | "fail",
) => ({
  artifact: "RUNTIME_PROFILE_OBSERVABILITY",
  version: 1,
  sourceSha: assignment.sourceSha,
  matrixDigest: assignment.matrixDigest,
  assignmentDigest: assignment.assignmentDigest,
  runId: RUN_ID,
  laneId: "a",
  profile: "minimal",
  serviceName: `customreport-api-runtime-${RUN_ID}-a-minimal`,
  startedAt: STARTED_AT,
  endedAt: ENDED_AT,
  appLog: {
    files: ["app.log"],
    records: 2,
    malformed: 0,
    counts: CLEAN_COUNTS,
  },
  loki: {
    records: 2,
    counts: CLEAN_COUNTS,
  },
  shutdownMarker: {
    message: SHUTDOWN_MESSAGE,
    appLog: 1,
    loki: 1,
  },
  status,
  issues: status === "pass" ? [] : ["missing Loki correlation"],
});

const bugsink = (assignment: RuntimeLaneAssignment) => ({
  artifact: "RUNTIME_BUGSINK_RUN_EVIDENCE",
  version: 1,
  sourceSha: assignment.sourceSha,
  matrixDigest: assignment.matrixDigest,
  assignmentDigest: assignment.assignmentDigest,
  runId: RUN_ID,
  startedAt: STARTED_AT,
  endedAt: ENDED_AT,
  observedAt: ENDED_AT,
  project: "runtime-sweep",
  baseline: { digested: 10, stored: 10 },
  final: { digested: 10, stored: 10 },
  delta: { digested: 0, stored: 0 },
  status: "pass",
  issues: [],
});

export const logRecords = (level: "info" | "error" = "info") =>
  [
    {
      timestamp: "2026-08-07T00:00:10.000Z",
      level,
      message: "trpc request end",
      correlationId: "corr-a",
    },
    {
      timestamp: "2026-08-07T00:00:20.000Z",
      level: "info",
      message: SHUTDOWN_MESSAGE,
      correlationId: NO_CONTEXT,
    },
  ] as const;

const shutdownCompletion = (assignment: RuntimeLaneAssignment) => ({
  artifact: "RUNTIME_PROFILE_SHUTDOWN_COMPLETE",
  version: 1,
  sourceSha: assignment.sourceSha,
  matrixDigest: assignment.matrixDigest,
  assignmentDigest: assignment.assignmentDigest,
  runId: RUN_ID,
  laneId: "a",
  profile: "minimal",
  serviceName: `customreport-api-runtime-${RUN_ID}-a-minimal`,
  startedAt: STARTED_AT,
  completedAt: "2026-08-07T00:00:30.000Z",
  acknowledgement: "api-drains-complete",
});

export const prepare = async (profileStatus: "pass" | "fail") => {
  const root = await mkdtemp(path.join(os.tmpdir(), "runtime-observer-merge-"));
  const assignment = assignmentFor(root);
  const run = runFor(assignment);
  const lane = assignment.lanes[0];
  if (lane === undefined)
    throw new Error("Runtime observability test lane is missing");
  await Promise.all([
    mkdir(path.join(lane.archiveRoot, "observability"), { recursive: true }),
    mkdir(path.join(lane.archiveRoot, "api-log", "minimal"), {
      recursive: true,
    }),
  ]);
  await writeRuntimeLaneRunIdentity(assignment, run);
  await Promise.all([
    writeJson(
      path.join(lane.archiveRoot, "OBSERVABILITY-READINESS.json"),
      readiness(assignment),
    ),
    writeJson(
      path.join(lane.archiveRoot, "observability", "minimal.json"),
      profile(assignment, profileStatus),
    ),
    writeJson(
      path.join(lane.archiveRoot, "observability", "minimal-shutdown.json"),
      shutdownCompletion(assignment),
    ),
    writeFile(
      path.join(lane.archiveRoot, "api-log", "minimal", "app.log"),
      `${logRecords()
        .map((record) => JSON.stringify(record))
        .join("\n")}\n`,
      "utf8",
    ),
    writeJson(
      path.join(root, `OBSERVABILITY-BUGSINK-${ASSIGNMENT_DIGEST}.json`),
      bugsink(assignment),
    ),
  ]);
  await writeRuntimeLaneObservabilityManifest(assignment, run, lane);
  return { assignment, lane };
};

export const rewriteProfileEvidence = async (
  prepared: Awaited<ReturnType<typeof prepare>>,
  report: unknown,
  records: readonly unknown[],
  completedAt?: string,
): Promise<void> => {
  await Promise.all([
    writeJson(
      path.join(prepared.lane.archiveRoot, "observability", "minimal.json"),
      report,
    ),
    writeFile(
      path.join(prepared.lane.archiveRoot, "api-log", "minimal", "app.log"),
      records.length === 0
        ? ""
        : `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
      "utf8",
    ),
    ...(completedAt === undefined
      ? []
      : [
          writeJson(
            path.join(
              prepared.lane.archiveRoot,
              "observability",
              "minimal-shutdown.json",
            ),
            { ...shutdownCompletion(prepared.assignment), completedAt },
          ),
        ]),
  ]);
  await unlink(
    path.join(prepared.lane.archiveRoot, "OBSERVABILITY-COMPLETE.json"),
  );
  await writeRuntimeLaneObservabilityManifest(
    prepared.assignment,
    runFor(prepared.assignment),
    prepared.lane,
  );
};
