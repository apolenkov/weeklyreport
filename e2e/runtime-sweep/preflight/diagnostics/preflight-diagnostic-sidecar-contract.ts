import { z } from "zod";

import {
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
} from "../../source/contracts.ts";
import {
  assertDiagnosticOutputPath,
  DiagnosticSidecarContractError,
} from "./preflight-diagnostic-sidecar-boundary.ts";
import {
  compactDiagnosticSampleFor,
  expandedDiagnosticSampleFor,
} from "./preflight-diagnostic-sidecar-wire.ts";

export { assertDiagnosticOutputPath, DiagnosticSidecarContractError };

export const PREFLIGHT_DIAGNOSTIC_SIDECAR =
  "PREFLIGHT_DIAGNOSTIC_SIDECAR" as const;
export const PREFLIGHT_DIAGNOSTIC_SIDECAR_VERSION = 1 as const;
export const PREFLIGHT_DIAGNOSTIC_SIDECAR_AUTHORITY =
  "diagnostic-only" as const;

export const DIAGNOSTIC_SAMPLE_INTERVAL_MS = 1000;
export const DIAGNOSTIC_MAX_TRACKED_PROCESSES = 3;
export const DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS = 900;
export const DIAGNOSTIC_MAX_EVENT_RECORDS = 32;
export const DIAGNOSTIC_MAX_RECORD_BYTES = 640;
export const DIAGNOSTIC_MAX_SIDECAR_BYTES = 1_850_000;
export const DIAGNOSTIC_MAX_MANIFEST_BYTES = 100_000;
export const DIAGNOSTIC_MAX_AGGREGATE_BYTES = 2_000_000;

const DIAGNOSTIC_STAGES = [
  "launch",
  "prepare",
  "navigate",
  "reveal-ready",
  "inventory",
  "failure",
  "cleanup",
] as const;
const DIAGNOSTIC_PROCESS_ROLES = [
  "playwright-child",
  "browser",
  "renderer",
] as const;
const DIAGNOSTIC_OPERATIONS = [
  "none",
  "prepare",
  "navigate",
  "wait-reveal",
  "inventory",
  "cleanup",
] as const;
const DIAGNOSTIC_FAILURE_KINDS = [
  "none",
  "page-crash",
  "page-close",
  "browser-disconnected",
  "playwright-error",
  "sidecar-overflow",
  "sidecar-io",
  "child-exit",
  "unknown",
] as const;
const DIAGNOSTIC_RECORD_KINDS = ["sample", "event"] as const;
const DIAGNOSTIC_PROCESS_CAPTURE_STATUSES = [
  "CAPTURED",
  "NOT_CAPTURED",
] as const;

export type DiagnosticStage = (typeof DIAGNOSTIC_STAGES)[number];
export type DiagnosticProcessRole = (typeof DIAGNOSTIC_PROCESS_ROLES)[number];
export type DiagnosticOperation = (typeof DIAGNOSTIC_OPERATIONS)[number];
export type DiagnosticFailureKind = (typeof DIAGNOSTIC_FAILURE_KINDS)[number];
export type DiagnosticProcessCaptureStatus =
  (typeof DIAGNOSTIC_PROCESS_CAPTURE_STATUSES)[number];

export const diagnosticProcessIdentityFor = (sample: {
  readonly processRole: DiagnosticProcessRole;
  readonly pid: number;
  readonly processStartWall: number;
}): string => `${sample.processRole}:${sample.pid}:${sample.processStartWall}`;

export function assertDiagnosticCampaignBinding(input: {
  readonly requestedCampaignId: string;
  readonly sourceCampaignId: string;
}): void {
  if (input.requestedCampaignId !== input.sourceCampaignId)
    throw new DiagnosticSidecarContractError(
      "Diagnostic campaignId must match SOURCE.json campaignId exactly",
    );
}

const nonNegativeInteger = z.number().int().nonnegative();
const nullableNonNegativeInteger = nonNegativeInteger.nullable();
const nullableNonNegativeNumber = z.number().nonnegative().nullable();

const diagnosticSampleSchema = z
  .object({
    recordKind: z.enum(DIAGNOSTIC_RECORD_KINDS),
    timestampWall: nonNegativeInteger,
    elapsedMs: nonNegativeInteger,
    stage: z.enum(DIAGNOSTIC_STAGES),
    pid: z.number().int().positive(),
    processRole: z.enum(DIAGNOSTIC_PROCESS_ROLES),
    processStartWall: nonNegativeInteger,
    parentPid: z.number().int().positive().nullable(),
    ownerRootPid: z.number().int().positive(),
    hostTotalBytes: nullableNonNegativeInteger,
    hostFreeBytes: nullableNonNegativeInteger,
    compressedBytes: nullableNonNegativeInteger,
    swapTotalBytes: nullableNonNegativeInteger,
    swapUsedBytes: nullableNonNegativeInteger,
    swapFreeBytes: nullableNonNegativeInteger,
    swapinsDelta: nullableNonNegativeInteger,
    swapoutsDelta: nullableNonNegativeInteger,
    pageinsDelta: nullableNonNegativeInteger,
    pageoutsDelta: nullableNonNegativeInteger,
    processRssBytes: nullableNonNegativeInteger,
    processVsizeBytes: nullableNonNegativeInteger,
    processFootprintBytes: nullableNonNegativeInteger,
    cpuPercent: nullableNonNegativeNumber,
    traceRecords: nullableNonNegativeInteger,
    harEntries: nullableNonNegativeInteger,
    artifactBytes: nullableNonNegativeInteger,
    currentOperation: z.enum(DIAGNOSTIC_OPERATIONS),
    failureKind: z.enum(DIAGNOSTIC_FAILURE_KINDS),
  })
  .strict();

export type DiagnosticSample = z.infer<typeof diagnosticSampleSchema>;

const diagnosticCampaignIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,127}$/u);

const processSampleCountsSchema = z
  .record(z.string(), nonNegativeInteger)
  .refine(
    (counts) =>
      Object.keys(counts).every((role) =>
        (DIAGNOSTIC_PROCESS_ROLES as readonly string[]).includes(role),
      ),
    "processSampleCounts contains an unknown process role",
  );
const processIdentitySampleCountsSchema = z.record(
  z.string().min(1),
  nonNegativeInteger,
);

export const diagnosticSidecarManifestSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_DIAGNOSTIC_SIDECAR),
    version: z.literal(PREFLIGHT_DIAGNOSTIC_SIDECAR_VERSION),
    authority: z.literal(PREFLIGHT_DIAGNOSTIC_SIDECAR_AUTHORITY),
    campaignId: diagnosticCampaignIdSchema,
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    sampleIntervalMs: z.literal(DIAGNOSTIC_SAMPLE_INTERVAL_MS),
    maxTrackedProcesses: z.literal(DIAGNOSTIC_MAX_TRACKED_PROCESSES),
    maxSamplesPerProcess: z.literal(DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS),
    maxEventRecords: z.literal(DIAGNOSTIC_MAX_EVENT_RECORDS),
    maxRecordBytes: z.literal(DIAGNOSTIC_MAX_RECORD_BYTES),
    maxSidecarBytes: z.literal(DIAGNOSTIC_MAX_SIDECAR_BYTES),
    maxManifestBytes: z.literal(DIAGNOSTIC_MAX_MANIFEST_BYTES),
    maxAggregateBytes: z.literal(DIAGNOSTIC_MAX_AGGREGATE_BYTES),
    sampleCount: nonNegativeInteger,
    eventCount: nonNegativeInteger,
    processCaptureStatus: z
      .object({
        "playwright-child": z.enum(DIAGNOSTIC_PROCESS_CAPTURE_STATUSES),
        browser: z.enum(DIAGNOSTIC_PROCESS_CAPTURE_STATUSES),
        renderer: z.enum(DIAGNOSTIC_PROCESS_CAPTURE_STATUSES),
      })
      .strict(),
    processSampleCounts: processSampleCountsSchema,
    processIdentitySampleCounts: processIdentitySampleCountsSchema,
    sidecarBytes: nonNegativeInteger,
    manifestBytes: nonNegativeInteger,
    aggregateBytes: nonNegativeInteger,
    sidecarDigest: sha256DigestSchema,
    sidecarPath: z.string().min(1),
    manifestPath: z.string().min(1),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
  })
  .strict();

export type DiagnosticSidecarManifest = z.infer<
  typeof diagnosticSidecarManifestSchema
>;

const expandedSampleForSchema = (value: unknown): unknown => {
  const expanded = expandedDiagnosticSampleFor(value);
  if (expanded.containsMixedKeys)
    throw new DiagnosticSidecarContractError(
      "Diagnostic sample cannot mix compact and canonical field keys",
    );
  return expanded.value;
};

export function assertDiagnosticRecordBytes(text: string): void {
  if (Buffer.byteLength(text, "utf8") > DIAGNOSTIC_MAX_RECORD_BYTES)
    throw new DiagnosticSidecarContractError(
      `Diagnostic sample exceeds the ${DIAGNOSTIC_MAX_RECORD_BYTES}-byte record bound`,
    );
}

export function serializeDiagnosticSample(value: unknown): string {
  const sample = parseDiagnosticSample(value);
  const text = `${JSON.stringify(compactDiagnosticSampleFor(sample))}\n`;
  assertDiagnosticRecordBytes(text);
  return text;
}

export function parseDiagnosticSample(value: unknown): DiagnosticSample {
  const parsed = diagnosticSampleSchema.safeParse(
    expandedSampleForSchema(value),
  );
  if (!parsed.success)
    throw new DiagnosticSidecarContractError(
      `Invalid diagnostic sample: ${parsed.error.message}`,
    );
  return parsed.data;
}

export function parseDiagnosticSidecarManifest(
  value: unknown,
): DiagnosticSidecarManifest {
  const parsed = diagnosticSidecarManifestSchema.safeParse(value);
  if (!parsed.success)
    throw new DiagnosticSidecarContractError(
      `Invalid diagnostic sidecar manifest: ${parsed.error.message}`,
    );
  return parsed.data;
}
