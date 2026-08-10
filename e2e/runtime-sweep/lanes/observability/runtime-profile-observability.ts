import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ServerLogRecord } from "../../evidence/evidence-types.ts";
import type { SeedProfile } from "../../source/contracts.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../runtime-lane-contract.ts";
import {
  type RuntimeLaneRunIdentity,
  runtimeProfileServiceName,
} from "../runtime-lane-run-identity.ts";
import type { RuntimeObservabilityConfig } from "../runtime-observability-readiness.ts";
import { readRuntimeProfileLog } from "./runtime-profile-log-reader.ts";
import {
  countsFor,
  discrepanciesFor,
  type LogCount,
} from "./runtime-profile-observability-counts.ts";
import {
  pollLokiCounts,
  pollLokiMessageCount,
} from "./runtime-profile-observability-query.ts";

const SHUTDOWN_BARRIER_MESSAGE = "API shutdown log barrier reached";

const logDirectoryFor = (lane: RuntimeLane, profile: SeedProfile): string =>
  path.join(lane.archiveRoot, "api-log", profile);

const shutdownMarkerCount = (records: readonly ServerLogRecord[]): number =>
  records.filter(({ message }) => message === SHUTDOWN_BARRIER_MESSAGE).length;

const timestamp = (value: string): number => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds))
    throw new Error("Runtime profile observability timestamp is invalid");
  return milliseconds;
};

const recordsInWindow = (
  records: readonly ServerLogRecord[],
  startedAt: string,
  endedAt: string,
): readonly ServerLogRecord[] => {
  const start = timestamp(startedAt);
  const end = timestamp(endedAt);
  return records.filter((record) => {
    const observed = Date.parse(record.timestamp);
    return Number.isFinite(observed) && observed >= start && observed <= end;
  });
};

const writeProfileObservabilityReport = async (
  input: Readonly<{
    readonly lane: RuntimeLane;
    readonly profile: SeedProfile;
    readonly assignment: RuntimeLaneAssignment;
    readonly run: RuntimeLaneRunIdentity;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly serviceName: string;
    readonly logFiles: readonly string[];
    readonly localRecords: readonly ServerLogRecord[];
    readonly malformedCount: number;
    readonly expected: readonly LogCount[];
    readonly actual: readonly LogCount[];
    readonly localShutdownMarkers: number;
    readonly lokiShutdownMarkers: number;
    readonly issues: readonly string[];
  }>,
): Promise<void> => {
  const report = {
    artifact: "RUNTIME_PROFILE_OBSERVABILITY",
    version: 1,
    sourceSha: input.assignment.sourceSha,
    matrixDigest: input.assignment.matrixDigest,
    assignmentDigest: input.assignment.assignmentDigest,
    runId: input.run.runId,
    laneId: input.lane.laneId,
    profile: input.profile,
    serviceName: input.serviceName,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    appLog: {
      files: input.logFiles,
      records: input.localRecords.length,
      malformed: input.malformedCount,
      counts: input.expected,
    },
    loki: {
      records: input.actual.reduce((sum, item) => sum + item.count, 0),
      counts: input.actual,
    },
    shutdownMarker: {
      message: SHUTDOWN_BARRIER_MESSAGE,
      appLog: input.localShutdownMarkers,
      loki: input.lokiShutdownMarkers,
    },
    issues: input.issues,
    status: input.issues.length === 0 ? "pass" : "fail",
  } as const;
  const directory = path.join(input.lane.archiveRoot, "observability");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${input.profile}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
};

const profileIssues = (
  localRecords: readonly ServerLogRecord[],
  malformedCount: number,
  expected: readonly LogCount[],
  actual: readonly LogCount[],
  localShutdownMarkers: number,
  lokiShutdownMarkers: number,
): readonly string[] => {
  const warnings = localRecords.filter(({ level }) => level === "warn");
  const errors = localRecords.filter(({ level }) => level === "error");
  return [
    ...(malformedCount === 0
      ? []
      : [`app.log contains ${String(malformedCount)} malformed line(s)`]),
    ...(localRecords.length > 0
      ? []
      : ["app.log contains no canonical record in the profile window"]),
    ...(warnings.length === 0
      ? []
      : [`profile contains ${String(warnings.length)} warning record(s)`]),
    ...(errors.length === 0
      ? []
      : [`profile contains ${String(errors.length)} error record(s)`]),
    ...(localShutdownMarkers === 1
      ? []
      : [
          `app.log contains ${String(localShutdownMarkers)} shutdown barrier record(s), expected 1`,
        ]),
    ...(lokiShutdownMarkers === 1
      ? []
      : [
          `Loki contains ${String(lokiShutdownMarkers)} shutdown barrier record(s), expected 1`,
        ]),
    ...discrepanciesFor(expected, actual),
  ];
};

export async function reconcileRuntimeProfileObservability(
  input: Readonly<{
    readonly lane: RuntimeLane;
    readonly profile: SeedProfile;
    readonly assignment: RuntimeLaneAssignment;
    readonly run: RuntimeLaneRunIdentity;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly observability: RuntimeObservabilityConfig;
    readonly fetcher?: typeof fetch;
  }>,
): Promise<void> {
  const parsed = await readRuntimeProfileLog(
    logDirectoryFor(input.lane, input.profile),
  );
  const localRecords = recordsInWindow(
    parsed.records,
    input.startedAt,
    input.endedAt,
  );
  const expected = countsFor(localRecords);
  const localShutdownMarkers = shutdownMarkerCount(localRecords);
  const serviceName = runtimeProfileServiceName(
    input.run,
    input.lane,
    input.profile,
  );
  const actual = await pollLokiCounts({
    config: input.observability.loki,
    serviceName,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    expected,
    fetcher: input.fetcher ?? fetch,
  });
  const lokiShutdownMarkers = await pollLokiMessageCount({
    config: input.observability.loki,
    serviceName,
    message: SHUTDOWN_BARRIER_MESSAGE,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    expected: 1,
    fetcher: input.fetcher ?? fetch,
  });
  const issues = profileIssues(
    localRecords,
    parsed.malformedCount,
    expected,
    actual,
    localShutdownMarkers,
    lokiShutdownMarkers,
  );
  await writeProfileObservabilityReport({
    ...input,
    serviceName,
    logFiles: parsed.files,
    localRecords,
    malformedCount: parsed.malformedCount,
    expected,
    actual,
    localShutdownMarkers,
    lokiShutdownMarkers,
    issues,
  });
  if (issues.length > 0)
    throw new Error(
      `Runtime lane ${input.lane.laneId}/${input.profile} observability failed: ${issues.join("; ")}`,
    );
}
