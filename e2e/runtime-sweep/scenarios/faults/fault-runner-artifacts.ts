import { writeFrozenCaseArtifact } from "../../replay/evidence/frozen-case-artifacts.ts";
import type { FrozenCaseReplayResult } from "../../replay/evidence/frozen-case-evidence.ts";
import type { EvidenceRef } from "../../source/contracts.ts";
import { coverageCellSchema } from "../../source/contracts.ts";
import type { FaultDeclaration } from "./fault-injection.ts";
import type { FaultCaseRunInput } from "./fault-runner.ts";
import type {
  PublishObservation,
  ReportState,
} from "./fault-runner-support.ts";

const executionFor = (input: FaultCaseRunInput) => {
  if (input.matrixCase.execution.kind !== "fault")
    throw new Error(`Expected fault execution for ${input.matrixCase.caseId}`);
  return input.matrixCase.execution;
};

export const actionArtifact = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
  observation: PublishObservation,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "action",
    fileName: "fault-action.json",
    kind: "control-action",
    dimension: "runtime",
    capturedAt: input.capturedAt,
    value: {
      faultId: declaration.id,
      mode: declaration.mode,
      controlKey: executionFor(input).action.controlKey,
      requestUrl: observation.request.url(),
      responseStatus: observation.response?.status() ?? null,
      requestFailure: observation.failure?.failure() ?? null,
      feedbackObserved: true,
      persistedState: "unchanged",
    },
  });

export const oracleArtifact = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
  before: ReportState,
  failed: ReportState,
  observation: PublishObservation,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "action",
    fileName: "fault-oracle.json",
    kind: "db",
    dimension: "function",
    capturedAt: input.capturedAt,
    value: {
      faultId: declaration.id,
      operation: declaration.operation,
      requestUrl: observation.request.url(),
      responseStatus: observation.response?.status() ?? null,
      requestFailure: observation.failure?.failure() ?? null,
      before,
      failed,
      nonMutation: JSON.stringify(before) === JSON.stringify(failed),
      recovery: declaration.expectation.recovery,
    },
  });

export const recoveryArtifact = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
  recovered: ReportState,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "fault-recovery.json",
    kind: "db",
    dimension: "runtime",
    capturedAt: input.capturedAt,
    value: {
      faultId: declaration.id,
      policy: declaration.expectation.recovery,
      recovered,
      recoveryObserved: true,
    },
  });

export const cleanupArtifact = async (
  input: FaultCaseRunInput,
  declaration: FaultDeclaration,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "fault-cleanup.json",
    kind: "db",
    dimension: "runtime",
    capturedAt: input.capturedAt,
    value: {
      faultId: declaration.id,
      routeInterceptor: "withFault teardown completed",
      database: "seed reset completed",
      cleanup: "complete",
    },
  });

export const finalizeFaultCoverage = async (
  input: FaultCaseRunInput,
  result: FrozenCaseReplayResult,
  cleanupRef: EvidenceRef,
): Promise<FrozenCaseReplayResult> => {
  const cell = coverageCellSchema.parse({
    ...result.cell,
    evidence: {
      ...result.cell.evidence,
      after: [...result.cell.evidence.after, cleanupRef],
    },
  });
  const finalResult = { cell, issues: result.issues };
  await input.testInfo.attach(`${input.matrixCase.caseId}.json`, {
    body: JSON.stringify(cell),
    contentType: "application/json",
  });
  return finalResult;
};
