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
}): DiagnosticSample {
  const processFields = diagnosticSampleFieldsFor(input.process);
  return {
    recordKind: input.recordKind,
    timestampWall: Date.now(),
    elapsedMs: input.elapsedMs,
    stage: input.stage,
    ...processFields,
    compressedBytes: null,
    swapTotalBytes: null,
    swapUsedBytes: null,
    swapFreeBytes: null,
    swapinsDelta: null,
    swapoutsDelta: null,
    pageinsDelta: null,
    pageoutsDelta: null,
    processFootprintBytes: null,
    traceRecords: null,
    harEntries: null,
    artifactBytes: null,
    currentOperation: input.currentOperation,
    failureKind: input.failureKind,
  };
}

export { readOwnedDiagnosticProcesses } from "./preflight-diagnostic-processes.ts";
