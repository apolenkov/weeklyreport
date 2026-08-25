import {
  DIAGNOSTIC_MAX_EVENT_RECORDS,
  DIAGNOSTIC_MAX_RECORD_BYTES,
  DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS,
  DIAGNOSTIC_MAX_SIDECAR_BYTES,
  DIAGNOSTIC_MAX_TRACKED_PROCESSES,
  type DiagnosticProcessRole,
  type DiagnosticSample,
} from "./preflight-diagnostic-sidecar-contract.ts";
import { DiagnosticSidecarIOError } from "./preflight-diagnostic-sidecar-types.ts";

const assertIdentityMetadataStable = (input: {
  readonly sample: DiagnosticSample;
  readonly identity: string;
  readonly processIdentityMetadata: ReadonlyMap<
    string,
    Readonly<{
      readonly parentPid: number | null;
      readonly ownerRootPid: number;
    }>
  >;
}): void => {
  const previousMetadata = input.processIdentityMetadata.get(input.identity);
  if (previousMetadata === undefined) return;
  if (
    previousMetadata.parentPid !== input.sample.parentPid ||
    previousMetadata.ownerRootPid !== input.sample.ownerRootPid
  )
    throw new DiagnosticSidecarIOError(
      `Diagnostic process identity changed: ${input.identity}`,
    );
};

const assertRecordLimit = (bytes: number): void => {
  if (bytes > DIAGNOSTIC_MAX_RECORD_BYTES)
    throw new DiagnosticSidecarIOError(
      "Diagnostic sample exceeds record byte bound",
    );
};

const assertSampleLimit = (input: {
  readonly sample: DiagnosticSample;
  readonly identity: string;
  readonly processIdentitySampleCounts: ReadonlyMap<string, number>;
}): void => {
  const previousCount =
    input.processIdentitySampleCounts.get(input.identity) ?? 0;
  if (
    input.sample.recordKind === "sample" &&
    previousCount >= DIAGNOSTIC_MAX_SAMPLES_PER_PROCESS
  )
    throw new DiagnosticSidecarIOError(
      `Diagnostic sample bound exceeded for process identity ${input.identity}`,
    );
};

const assertEventLimit = (
  sample: DiagnosticSample,
  eventCount: number,
): void => {
  if (
    sample.recordKind === "event" &&
    eventCount >= DIAGNOSTIC_MAX_EVENT_RECORDS
  )
    throw new DiagnosticSidecarIOError(
      "Diagnostic event record bound exceeded",
    );
};

const assertIdentityLimit = (
  identity: string,
  trackedProcessIdentities: ReadonlySet<string>,
): void => {
  if (
    !trackedProcessIdentities.has(identity) &&
    trackedProcessIdentities.size >= DIAGNOSTIC_MAX_TRACKED_PROCESSES
  )
    throw new DiagnosticSidecarIOError(
      "Diagnostic tracked-process bound exceeded",
    );
};

const assertSidecarLimit = (sidecarBytes: number, bytes: number): void => {
  if (sidecarBytes + bytes > DIAGNOSTIC_MAX_SIDECAR_BYTES)
    throw new DiagnosticSidecarIOError("Diagnostic sidecar exceeds byte bound");
};

export function assertDiagnosticRecordBounds(input: {
  readonly sample: DiagnosticSample;
  readonly identity: string;
  readonly bytes: number;
  readonly sidecarBytes: number;
  readonly eventCount: number;
  readonly trackedProcessIdentities: ReadonlySet<string>;
  readonly processIdentitySampleCounts: ReadonlyMap<string, number>;
  readonly processIdentityMetadata: ReadonlyMap<
    string,
    Readonly<{
      readonly parentPid: number | null;
      readonly ownerRootPid: number;
    }>
  >;
}): void {
  if (input.sample.processRole === "renderer")
    throw new DiagnosticSidecarIOError(
      "Renderer capture requires a page-bound process proof",
    );
  assertIdentityMetadataStable(input);
  assertRecordLimit(input.bytes);
  assertSampleLimit(input);
  assertEventLimit(input.sample, input.eventCount);
  assertIdentityLimit(input.identity, input.trackedProcessIdentities);
  assertSidecarLimit(input.sidecarBytes, input.bytes);
}

export function recordDiagnosticRecord(input: {
  readonly sample: DiagnosticSample;
  readonly identity: string;
  readonly processSampleCounts: Map<DiagnosticProcessRole, number>;
  readonly processIdentitySampleCounts: Map<string, number>;
  readonly sampleCount: number;
  readonly eventCount: number;
}): Readonly<{ readonly sampleCount: number; readonly eventCount: number }> {
  if (input.sample.recordKind === "event")
    return { sampleCount: input.sampleCount, eventCount: input.eventCount + 1 };
  const roleCount =
    input.processSampleCounts.get(input.sample.processRole) ?? 0;
  input.processSampleCounts.set(input.sample.processRole, roleCount + 1);
  input.processIdentitySampleCounts.set(
    input.identity,
    (input.processIdentitySampleCounts.get(input.identity) ?? 0) + 1,
  );
  return { sampleCount: input.sampleCount + 1, eventCount: input.eventCount };
}
