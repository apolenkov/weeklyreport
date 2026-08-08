import { collectServerLogEvidence } from "../../evidence/server-log-evidence.ts";
import {
  type EvidenceBundle,
  evidenceObservationSchema,
  type EvidenceRef,
} from "../../source/contracts.ts";
import type { ControlActionRecoveryOutcome } from "../control-action-types.ts";
import { writeFrozenCaseArtifact } from "../frozen-case-artifacts.ts";
import type { FrozenPhaseInput } from "../frozen-case-live-capture-types.ts";
import type { FrozenRuntimeEvidenceWindow } from "./frozen-case-recovery-boundary.ts";

export type FrozenRecoveryEvidence = Readonly<{
  readonly ref: EvidenceRef;
  readonly observation: EvidenceBundle["observations"][number];
}>;

const stateOracleFor = (outcome: ControlActionRecoveryOutcome) =>
  outcome.status === "pass"
    ? { required: true, status: "pass" as const }
    : {
        required: true,
        status: "not-proven" as const,
        reason: outcome.reason,
      };

const failureCount = (
  window: FrozenRuntimeEvidenceWindow,
  outcome: ControlActionRecoveryOutcome,
  serverLogs: Awaited<ReturnType<typeof collectServerLogEvidence>>,
): number =>
  window.records.consoleMessages.length +
  window.records.pageErrors.length +
  window.records.requestFailures.length +
  window.records.responses.filter(({ ok }) => !ok).length +
  Number(!serverLogs.available) +
  serverLogs.malformedCount +
  serverLogs.missingCorrelationIds.length +
  serverLogs.errorCount +
  serverLogs.warningCount +
  serverLogs.slowCount +
  Number(outcome.status === "fail");

export const captureFrozenRecoveryEvidence = async (
  input: FrozenPhaseInput,
  window: FrozenRuntimeEvidenceWindow,
  outcome: ControlActionRecoveryOutcome,
): Promise<FrozenRecoveryEvidence> => {
  const serverLogs = await collectServerLogEvidence({
    path: input.runtime.apiLogPath,
    responses: window.records.responses,
    startedAt: window.startedAt,
    endedAt: window.endedAt,
  });
  const failures = failureCount(window, outcome, serverLogs);
  const ref = await writeFrozenCaseArtifact({
    archiveRoot: input.runtime.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "action",
    fileName: "recovery-evidence.json",
    kind: "log",
    dimension: "runtime",
    capturedAt: window.endedAt,
    value: {
      window,
      outcome,
      stateOracle: stateOracleFor(outcome),
      serverLogs,
    },
  });
  return {
    ref,
    observation: evidenceObservationSchema.parse({
      observationId: "action-recovery",
      kind: "api",
      outcome: failures === 0 ? "pass" : "fail",
      message: `Recovery ${outcome.status}; ${window.records.responses.length} response(s), ${window.records.requestFailures.length} request failure(s), ${serverLogs.warningCount} server warning(s), ${serverLogs.errorCount} server error(s), ${serverLogs.slowCount} slow recovery operation(s)`,
      evidenceIds: [ref.artifactId],
    }),
  };
};
