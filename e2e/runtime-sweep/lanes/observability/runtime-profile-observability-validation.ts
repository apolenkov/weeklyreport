import path from "node:path";

import { z } from "zod";

import {
  type SeedProfile,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
} from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../runtime-lane-contract.ts";
import type { RuntimeObservabilityConfig } from "../runtime-observability-readiness.ts";
import { readRuntimeProfileLog } from "./runtime-profile-log-reader.ts";
import {
  countsFor,
  type RuntimeLokiEvidence,
} from "./runtime-profile-observability-counts.ts";
import { queryRuntimeLokiEvidence } from "./runtime-profile-observability-query.ts";

const countSchema = z
  .object({
    correlationId: z.string().min(1),
    level: z.enum(["debug", "info", "warn", "error"]),
    count: z.number().int().positive(),
  })
  .strict();

const profileSchema = z
  .object({
    artifact: z.literal("RUNTIME_PROFILE_OBSERVABILITY"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    assignmentDigest: sha256DigestSchema,
    runId: z.uuid(),
    laneId: z.string().min(1),
    profile: seedProfileSchema,
    serviceName: z.string().min(1),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    appLog: z
      .object({
        files: z.array(z.string().min(1)).min(1).readonly(),
        records: z.number().int().nonnegative(),
        malformed: z.number().int().nonnegative(),
        counts: z.array(countSchema).readonly(),
      })
      .strict(),
    loki: z
      .object({
        records: z.number().int().nonnegative(),
        counts: z.array(countSchema).readonly(),
      })
      .strict(),
    shutdownMarker: z
      .object({
        message: z.literal("API shutdown log barrier reached"),
        appLog: z.number().int().nonnegative(),
        loki: z.number().int().nonnegative(),
      })
      .strict(),
    issues: z.array(z.string()).readonly(),
    status: z.enum(["pass", "fail"]),
  })
  .strict();

export type RuntimeProfileObservabilityReport = z.infer<typeof profileSchema>;

export const runtimeObservabilityTimestamp = (value: string): number => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds))
    throw new Error("Runtime observability timestamp is invalid");
  return milliseconds;
};

const recordsInWindow = (
  records: Awaited<ReturnType<typeof readRuntimeProfileLog>>["records"],
  startedAt: string,
  endedAt: string,
) => {
  const start = runtimeObservabilityTimestamp(startedAt);
  const end = runtimeObservabilityTimestamp(endedAt);
  return records.filter(({ timestamp }) => {
    const observed = Date.parse(timestamp);
    return Number.isFinite(observed) && observed >= start && observed <= end;
  });
};

const sumCounts = (counts: readonly z.infer<typeof countSchema>[]): number =>
  counts.reduce((sum, count) => sum + count.count, 0);

type ValidationInput = Readonly<{
  assignment: RuntimeLaneAssignment;
  runId: string;
  lane: RuntimeLane;
  profile: SeedProfile;
  runWindow: Readonly<{ startedAt: string; endedAt: string }>;
  observability: RuntimeObservabilityConfig;
  fetcher: typeof fetch;
}>;

type ParsedLogs = Awaited<ReturnType<typeof readRuntimeProfileLog>>;
type LocalEvidence = Readonly<{
  counts: ReturnType<typeof countsFor>;
  shutdownMarkers: number;
  shutdownMarkerAt: string | undefined;
}>;

const issueUnless = (condition: boolean, issue: string): readonly string[] =>
  condition ? [] : [issue];

const identityMatches = (
  report: RuntimeProfileObservabilityReport,
  input: ValidationInput,
): boolean =>
  report.sourceSha === input.assignment.sourceSha &&
  report.matrixDigest === input.assignment.matrixDigest &&
  report.assignmentDigest === input.assignment.assignmentDigest &&
  report.runId === input.runId &&
  report.laneId === input.lane.laneId &&
  report.profile === input.profile &&
  report.serviceName ===
    `customreport-api-runtime-${input.runId}-${input.lane.laneId}-${input.profile}`;

const windowMatches = (
  report: RuntimeProfileObservabilityReport,
  input: ValidationInput,
): boolean => {
  const start = runtimeObservabilityTimestamp(report.startedAt);
  const end = runtimeObservabilityTimestamp(report.endedAt);
  return (
    start <= end &&
    start >= runtimeObservabilityTimestamp(input.runWindow.startedAt) &&
    end <= runtimeObservabilityTimestamp(input.runWindow.endedAt)
  );
};

const localEvidenceFor = (
  report: RuntimeProfileObservabilityReport,
  parsedLogs: ParsedLogs,
): LocalEvidence => {
  const records = recordsInWindow(
    parsedLogs.records,
    report.startedAt,
    report.endedAt,
  );
  const shutdownRecords = records.filter(
    ({ message }) => message === report.shutdownMarker.message,
  );
  return {
    counts: countsFor(records),
    shutdownMarkers: shutdownRecords.length,
    shutdownMarkerAt: shutdownRecords[0]?.timestamp,
  };
};

const localLogMatches = (
  report: RuntimeProfileObservabilityReport,
  parsedLogs: ParsedLogs,
  evidence: LocalEvidence,
): boolean =>
  report.appLog.records > 0 &&
  report.appLog.malformed === 0 &&
  parsedLogs.malformedCount === report.appLog.malformed &&
  stableSerialize(parsedLogs.files) === stableSerialize(report.appLog.files) &&
  stableSerialize(evidence.counts) === stableSerialize(report.appLog.counts);

const lokiCountsMatch = (
  report: RuntimeProfileObservabilityReport,
  live: RuntimeLokiEvidence,
): boolean =>
  sumCounts(report.appLog.counts) === report.appLog.records &&
  sumCounts(report.loki.counts) === report.loki.records &&
  stableSerialize(report.appLog.counts) ===
    stableSerialize(report.loki.counts) &&
  stableSerialize(report.loki.counts) === stableSerialize(live.counts) &&
  report.shutdownMarker.loki === live.shutdownMarkers;

const reportIssues = (
  report: RuntimeProfileObservabilityReport,
  input: ValidationInput,
  parsedLogs: ParsedLogs,
  evidence: LocalEvidence,
  liveLoki: RuntimeLokiEvidence,
): readonly string[] => {
  return [
    ...issueUnless(identityMatches(report, input), "identity"),
    ...issueUnless(windowMatches(report, input), "window"),
    ...issueUnless(
      report.status === "pass" && report.issues.length === 0,
      "declared-status",
    ),
    ...issueUnless(localLogMatches(report, parsedLogs, evidence), "local-log"),
    ...issueUnless(
      evidence.counts.every(
        ({ level }) => level !== "warn" && level !== "error",
      ),
      "prohibited-level",
    ),
    ...issueUnless(
      evidence.shutdownMarkers === 1 &&
        report.shutdownMarker.appLog === 1 &&
        report.shutdownMarker.loki === 1 &&
        liveLoki.shutdownMarkers === 1,
      "shutdown-marker",
    ),
    ...issueUnless(lokiCountsMatch(report, liveLoki), "loki-counts"),
  ];
};

export const validateRuntimeProfileObservabilityReport = async (
  value: unknown,
  input: ValidationInput,
): Promise<
  Readonly<{
    report: RuntimeProfileObservabilityReport;
    shutdownMarkerAt: string;
  }>
> => {
  const report = profileSchema.parse(value);
  const parsedLogs = await readRuntimeProfileLog(
    path.join(input.lane.archiveRoot, "api-log", input.profile),
  );
  const liveLoki = await queryRuntimeLokiEvidence({
    config: input.observability.loki,
    serviceName: report.serviceName,
    message: report.shutdownMarker.message,
    startedAt: report.startedAt,
    endedAt: report.endedAt,
    fetcher: input.fetcher,
  });
  const localEvidence = localEvidenceFor(report, parsedLogs);
  if (
    reportIssues(report, input, parsedLogs, localEvidence, liveLoki).length > 0
  )
    throw new Error(
      `Runtime observability report is inconsistent for ${input.lane.laneId}/${input.profile}`,
    );
  if (localEvidence.shutdownMarkerAt === undefined)
    throw new Error("Runtime shutdown marker timestamp is missing");
  return { report, shutdownMarkerAt: localEvidence.shutdownMarkerAt };
};
