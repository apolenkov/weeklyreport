import {
  DIAGNOSTIC_MAX_AGGREGATE_BYTES,
  DIAGNOSTIC_MAX_EVENT_RECORDS,
  DIAGNOSTIC_MAX_MANIFEST_BYTES,
  DIAGNOSTIC_MAX_RECORD_BYTES,
  DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS,
  DIAGNOSTIC_MAX_SIDECAR_BYTES,
  DIAGNOSTIC_MAX_TRACKED_PROCESSES,
  DIAGNOSTIC_SAMPLE_INTERVAL_MS,
  type DiagnosticProcessCaptureStatus,
  type DiagnosticProcessRole,
  type DiagnosticSidecarManifest,
  PREFLIGHT_DIAGNOSTIC_SIDECAR,
  PREFLIGHT_DIAGNOSTIC_SIDECAR_AUTHORITY,
  PREFLIGHT_DIAGNOSTIC_SIDECAR_VERSION,
} from "./preflight-diagnostic-sidecar-contract.ts";

export function diagnosticManifestBaseFor(input: {
  readonly campaignId: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly sampleCount: number;
  readonly eventCount: number;
  readonly processCaptureStatus: Readonly<
    Record<DiagnosticProcessRole, DiagnosticProcessCaptureStatus>
  >;
  readonly processSampleCounts: ReadonlyMap<DiagnosticProcessRole, number>;
  readonly processIdentitySampleCounts: ReadonlyMap<string, number>;
  readonly sidecarBytes: number;
  readonly sidecarDigest: string;
  readonly sidecarPath: string;
  readonly manifestPath: string;
  readonly startedAt: string;
  readonly completedAt: string;
}): Omit<DiagnosticSidecarManifest, "manifestBytes" | "aggregateBytes"> {
  return {
    artifact: PREFLIGHT_DIAGNOSTIC_SIDECAR,
    version: PREFLIGHT_DIAGNOSTIC_SIDECAR_VERSION,
    authority: PREFLIGHT_DIAGNOSTIC_SIDECAR_AUTHORITY,
    campaignId: input.campaignId,
    sourceSha: input.sourceSha,
    sourceTree: input.sourceTree,
    sampleIntervalMs: DIAGNOSTIC_SAMPLE_INTERVAL_MS,
    maxTrackedProcesses: DIAGNOSTIC_MAX_TRACKED_PROCESSES,
    maxSamplesPerProcess: DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS,
    maxEventRecords: DIAGNOSTIC_MAX_EVENT_RECORDS,
    maxRecordBytes: DIAGNOSTIC_MAX_RECORD_BYTES,
    maxSidecarBytes: DIAGNOSTIC_MAX_SIDECAR_BYTES,
    maxManifestBytes: DIAGNOSTIC_MAX_MANIFEST_BYTES,
    maxAggregateBytes: DIAGNOSTIC_MAX_AGGREGATE_BYTES,
    sampleCount: input.sampleCount,
    eventCount: input.eventCount,
    processCaptureStatus: input.processCaptureStatus,
    processSampleCounts: Object.fromEntries(input.processSampleCounts),
    processIdentitySampleCounts: Object.fromEntries(
      input.processIdentitySampleCounts,
    ),
    sidecarBytes: input.sidecarBytes,
    sidecarDigest: input.sidecarDigest,
    sidecarPath: input.sidecarPath,
    manifestPath: input.manifestPath,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}
