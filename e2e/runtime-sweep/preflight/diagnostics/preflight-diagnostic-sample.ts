import type { DiagnosticHostPressure } from "./preflight-diagnostic-host-pressure.ts";
import { diagnosticSampleFieldsFor } from "./preflight-diagnostic-process-fields.ts";
import { type DiagnosticProcessSnapshot } from "./preflight-diagnostic-processes.ts";
import type {
  DiagnosticFailureKind,
  DiagnosticOperation,
  DiagnosticSample,
  DiagnosticStage,
} from "./preflight-diagnostic-sidecar-contract.ts";

export function diagnosticSampleForProcess(input: {
  readonly recordKind: DiagnosticSample["recordKind"];
  readonly elapsedMs: number;
  readonly stage: DiagnosticStage;
  readonly currentOperation: DiagnosticOperation;
  readonly failureKind: DiagnosticFailureKind;
  readonly process: DiagnosticProcessSnapshot;
  readonly hostPressure?: DiagnosticHostPressure;
}): DiagnosticSample {
  const processFields = diagnosticSampleFieldsFor(input.process);
  return {
    recordKind: input.recordKind,
    timestampWall: Date.now(),
    elapsedMs: input.elapsedMs,
    stage: input.stage,
    ...processFields,
    compressedBytes: input.hostPressure?.compressedBytes ?? null,
    swapTotalBytes: input.hostPressure?.swapTotalBytes ?? null,
    swapUsedBytes: input.hostPressure?.swapUsedBytes ?? null,
    swapFreeBytes: input.hostPressure?.swapFreeBytes ?? null,
    swapinsDelta: input.hostPressure?.swapinsDelta ?? null,
    swapoutsDelta: input.hostPressure?.swapoutsDelta ?? null,
    pageinsDelta: input.hostPressure?.pageinsDelta ?? null,
    pageoutsDelta: input.hostPressure?.pageoutsDelta ?? null,
    processFootprintBytes: null,
    traceRecords: null,
    harEntries: null,
    artifactBytes: null,
    currentOperation: input.currentOperation,
    failureKind: input.failureKind,
  };
}

export { createDiagnosticHostPressureSampler } from "./preflight-diagnostic-host-pressure.ts";
export { readOwnedDiagnosticProcesses } from "./preflight-diagnostic-processes.ts";
